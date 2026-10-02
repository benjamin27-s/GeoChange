from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from backend.app.api.detect import router as detect_router
from backend.app.api.predict import router as predict_router
from backend.app.api.async_inference import router as async_inference_router

logging.basicConfig(level=logging.INFO)


app = FastAPI(
    title="Satellite AI Dashboard API",
    description=(
        "Backend foundation for satellite change detection, future prediction, "
        "Earth Engine integration, and frontend globe workflows."
    ),
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:5174",
        "http://localhost:5174",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(detect_router)
app.include_router(predict_router)
app.include_router(async_inference_router)


@app.get("/", tags=["health"])
def health_check():
    """Return a lightweight service health response."""
    return {"status": "running"}
