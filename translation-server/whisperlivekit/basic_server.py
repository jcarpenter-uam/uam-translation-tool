import asyncio
import base64
import json
import logging
from contextlib import asynccontextmanager
from typing import Any, Dict, Set

from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from whisperlivekit import AudioProcessor, TranscriptionEngine, parse_args

logging.basicConfig(
    level=logging.INFO, format="%(asctime=s) - %(levelname)s - %(message)s"
)
logging.getLogger().setLevel(logging.WARNING)
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

args = parse_args()
transcription_engine = None

clients: Set[WebSocket] = set()
speakers: Dict[WebSocket, Dict[str, Any]] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    # to remove after 0.2.8
    if args.backend == "simulstreaming" and not args.disable_fast_encoder:
        logger.warning(
            f"""
{'='*50}
WhisperLiveKit 0.2.8 has introduced a new fast encoder feature using MLX Whisper or Faster Whisper for improved speed. Use --disable-fast-encoder to disable if you encounter issues.
{'='*50}
    """
        )

    global transcription_engine
    transcription_engine = TranscriptionEngine(
        **vars(args),
    )
    yield


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def broadcast(message: dict):
    """Broadcasts a message to all connected clients."""
    for client in clients:
        try:
            await client.send_json(message)
        except Exception as e:
            logger.error(f"Error broadcasting to a client: {e}")


async def handle_websocket_results(results_generator, user_name: str):
    """Consumes results from an audio processor and broadcasts them with the user's name."""
    try:
        async for response in results_generator:
            # Inject the speaker's name into the response
            response["user_name"] = user_name
            # logger.info(f"Broadcasting to viewers: {response}")
            await broadcast(response)
        logger.info(f"Results generator for {user_name} finished.")
        # This message can also include the user name if needed
        await broadcast({"type": "ready_to_stop", "user_name": user_name})
    except Exception as e:
        logger.exception(f"Error in WebSocket results handler for {user_name}: {e}")


# --- REWRITTEN WEBSOCKET ENDPOINT ---
@app.websocket("/asr")
async def websocket_endpoint(websocket: WebSocket, role: str = Query(None)):
    await websocket.accept()
    clients.add(websocket)
    logger.info(f"Client connected with role: {role}")

    if role == "speaker":
        # This dictionary will hold the processor and task for each unique speaker.
        # The key will be the speaker's username.
        speaker_processors: Dict[str, Dict[str, Any]] = {}

        try:
            while True:
                message_text = await websocket.receive_text()
                payload = json.loads(message_text)

                user_name = payload.get("userName")
                audio_b64 = payload.get("audioData")

                # If we don't have a username, we can't process the audio.
                if not user_name:
                    continue

                # Check if this is a new speaker.
                if user_name not in speaker_processors:
                    logger.info(
                        f"New speaker '{user_name}' detected. Creating new transcription session."
                    )

                    # Create a dedicated audio processor and task for the new speaker.
                    new_processor = AudioProcessor(
                        transcription_engine=transcription_engine
                    )
                    new_results_generator = await new_processor.create_tasks()
                    new_task = asyncio.create_task(
                        handle_websocket_results(new_results_generator, user_name)
                    )

                    # Store the new processor and task in our dictionary.
                    speaker_processors[user_name] = {
                        "processor": new_processor,
                        "task": new_task,
                    }

                # Route the audio data to the correct speaker's processor.
                if audio_b64:
                    processor = speaker_processors[user_name]["processor"]
                    audio_bytes = base64.b64decode(audio_b64)
                    await processor.process_audio(audio_bytes)

        except WebSocketDisconnect:
            logger.info(
                "Speaker client disconnected. Cleaning up all speaker sessions."
            )
        except Exception as e:
            logger.error(f"Error with speaker client: {e}", exc_info=True)
        finally:
            # Clean up all transcription tasks and processors when the connection closes.
            for user_name, data in speaker_processors.items():
                logger.info(f"Cleaning up resources for speaker '{user_name}'.")
                if not data["task"].done():
                    data["task"].cancel()
                await data["processor"].cleanup()

    else:  # Viewer client
        try:
            # Keep the connection open to receive broadcasts
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            logger.info("A viewer disconnected.")
        except Exception as e:
            logger.error(f"Error with viewer client: {e}", exc_info=True)

    # General cleanup
    if websocket in clients:
        clients.remove(websocket)
    logger.info("Client disconnected.")


def main():
    """Entry point for the CLI command."""
    import uvicorn

    uvicorn_kwargs = {
        "app": "whisperlivekit.basic_server:app",
        "host": args.host,
        "port": args.port,
        "reload": True,
        "log_level": "info",
        "lifespan": "on",
    }

    ssl_kwargs = {}
    if args.ssl_certfile or args.ssl_keyfile:
        if not (args.ssl_certfile and args.ssl_keyfile):
            raise ValueError(
                "Both --ssl-certfile and --ssl-keyfile must be specified together."
            )
        ssl_kwargs = {
            "ssl_certfile": args.ssl_certfile,
            "ssl_keyfile": args.ssl_keyfile,
        }

    if ssl_kwargs:
        uvicorn_kwargs = {**uvicorn_kwargs, **ssl_kwargs}

    uvicorn.run(**uvicorn_kwargs)


if __name__ == "__main__":
    main()
