import asyncio
import logging
import pathlib
from contextlib import asynccontextmanager
from typing import Set

from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from whisperlivekit import AudioProcessor, TranscriptionEngine, parse_args

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logging.getLogger().setLevel(logging.WARNING)
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

args = parse_args()
transcription_engine = None

clients: Set[WebSocket] = set()
host_client: WebSocket = None


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


async def handle_websocket_results(results_generator):
    """Consumes results from the audio processor and broadcasts them."""
    try:
        async for response in results_generator:
            await broadcast(response)
        logger.info("Results generator finished. Broadcasting 'ready_to_stop'.")
        await broadcast({"type": "ready_to_stop"})
    except Exception as e:
        logger.exception(f"Error in WebSocket results handler: {e}")


@app.websocket("/asr")
async def websocket_endpoint(websocket: WebSocket, role: str = Query(None)):
    global host_client
    await websocket.accept()
    clients.add(websocket)
    logger.info(f"Client connected with role: {role}")

    if role == "host":
        if host_client is not None:
            await websocket.send_json({"error": "A host is already connected."})
            await websocket.close()
            clients.remove(websocket)
            return

        host_client = websocket
        audio_processor = AudioProcessor(
            transcription_engine=transcription_engine,
        )
        results_generator = await audio_processor.create_tasks()
        websocket_task = asyncio.create_task(
            handle_websocket_results(results_generator)
        )

        try:
            while True:
                message = await websocket.receive_bytes()
                await audio_processor.process_audio(message)
        except WebSocketDisconnect:
            logger.info("Host disconnected.")
        except Exception as e:
            logger.error(f"Error with host client: {e}", exc_info=True)
        finally:
            host_client = None
            if not websocket_task.done():
                websocket_task.cancel()
            await audio_processor.cleanup()

    else:  # Viewer client
        try:
            # Keep the connection open to receive broadcasts
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            logger.info("A viewer disconnected.")
        except Exception as e:
            logger.error(f"Error with viewer client: {e}", exc_info=True)

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
        # "reload": False,
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
