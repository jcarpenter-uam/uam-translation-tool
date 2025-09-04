import base64
import logging

from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from starlette.staticfiles import StaticFiles

logger = logging.getLogger(__name__)


def get_inline_ui_html():
    """Returns the complete web interface HTML with all assets embedded in a single call."""
    try:
        with open("live_transcription.html", "r", encoding="utf-8") as f:
            html_content = f.read()
        with open("live_transcription.css", "r", encoding="utf-8") as f:
            css_content = f.read()
        with open("live_transcription.js", "r", encoding="utf-8") as f:
            js_content = f.read()

        with open("src/system_mode.svg", "r", encoding="utf-8") as f:
            system_svg = f.read()
            system_data_uri = f"data:image/svg+xml;base64,{base64.b64encode(system_svg.encode('utf-8')).decode('utf-8')}"
        with open("src/light_mode.svg", "r", encoding="utf-8") as f:
            light_svg = f.read()
            light_data_uri = f"data:image/svg+xml;base64,{base64.b64encode(light_svg.encode('utf-8')).decode('utf-8')}"
        with open("src/dark_mode.svg", "r", encoding="utf-8") as f:
            dark_svg = f.read()
            dark_data_uri = f"data:image/svg+xml;base64,{base64.b64encode(dark_svg.encode('utf-8')).decode('utf-8')}"

        html_content = html_content.replace(
            '<link rel="stylesheet" href="live_transcription.css" />',
            f"<style>\n{css_content}\n</style>",
        )

        html_content = html_content.replace(
            '<script src="live_transcription.js"></script>',
            f"<script>\n{js_content}\n</script>",
        )

        html_content = html_content.replace(
            '<img src="src/system_mode.svg" alt="" />',
            f'<img src="{system_data_uri}" alt="" />',
        )

        html_content = html_content.replace(
            '<img src="src/light_mode.svg" alt="" />',
            f'<img src="{light_data_uri}" alt="" />',
        )

        html_content = html_content.replace(
            '<img src="src/dark_mode.svg" alt="" />',
            f'<img src="{dark_data_uri}" alt="" />',
        )

        return html_content

    except Exception as e:
        logger.error(f"Error creating embedded web interface: {e}")
        return "<html><body><h1>Error loading embedded interface</h1></body></html>"


# Create the FastAPI app
app = FastAPI()

# Mount the static directories to serve original assets if needed
app.mount("/src", StaticFiles(directory="src"), name="src")


# Define the root endpoint to serve the inline HTML
@app.get("/")
async def get():
    return HTMLResponse(get_inline_ui_html())
