"""Local API for the Floorplan-to-3D portfolio demo.

Run from the CubiCasa5K project folder after installing requirements-local.txt.
The weights stay outside this website repository.
"""
from __future__ import annotations

import io
import os
import sys
from pathlib import Path

import cv2
import numpy as np
import torch
import torch.nn.functional as F
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

PROJECT_ROOT = Path(os.environ.get("CUBICASA_PROJECT_ROOT", r"C:\2_coursework\201_nyu_in_curriculum\6_personal_project\machinea_learning\CubiCasa5k"))
WEIGHTS_PATH = Path(os.environ.get("CUBICASA_WEIGHTS", PROJECT_ROOT / "model_best_val_loss_var.pkl"))
sys.path.insert(0, str(PROJECT_ROOT))

from floortrans.models.hg_furukawa_original import hg_furukawa_original  # noqa: E402

app = FastAPI(title="Floorplan-to-3D local inference")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model = None


def load_model():
    global model
    if model is not None:
        return model
    if not WEIGHTS_PATH.exists():
        raise FileNotFoundError(f"Weights not found: {WEIGHTS_PATH}")
    # The upstream helper calls init_weights(), which expects a separate
    # ImageNet checkpoint. Our trained checkpoint already contains all weights.
    net = hg_furukawa_original(51)
    net.conv4_ = torch.nn.Conv2d(256, 44, bias=True, kernel_size=1)
    net.upsample = torch.nn.ConvTranspose2d(44, 44, kernel_size=4, stride=4)
    checkpoint = torch.load(WEIGHTS_PATH, map_location=device, weights_only=False)
    net.load_state_dict(checkpoint["model_state"])
    net.eval().to(device)
    model = net
    return model


def prepare_image(raw: bytes):
    image = Image.open(io.BytesIO(raw)).convert("RGB")
    # Keep inference responsive and preserve aspect ratio.
    image.thumbnail((1200, 1200))
    pixels = np.asarray(image).astype(np.float32) / 255.0
    tensor = torch.from_numpy(np.moveaxis((pixels - .5) / .5, -1, 0)).unsqueeze(0)
    return pixels, tensor


def infer(tensor):
    net = load_model()
    tensor = tensor.to(device)
    _, _, height, width = tensor.shape
    rotations = [(0, 0), (1, -1), (2, 2), (-1, 1)]
    with torch.no_grad():
        predictions = []
        for forward, back in rotations:
            rotated = torch.rot90(tensor, forward, dims=(2, 3))
            pred = net(rotated)
            pred = torch.rot90(pred, back, dims=(2, 3))
            predictions.append(F.interpolate(pred, size=(height, width), mode="bilinear", align_corners=True))
    return torch.mean(torch.stack(predictions), dim=0), (height, width)


def vectors_from_prediction(prediction, size):
    # Direct semantic maps are robust across the current SciPy release. The
    # notebook's optional polygon repair can be added later without changing
    # the web API response format.
    room_seg = torch.argmax(F.softmax(prediction[0, 21:33], dim=0), dim=0).cpu().numpy()
    icon_seg = torch.argmax(F.softmax(prediction[0, 33:44], dim=0), dim=0).cpu().numpy()
    wall_mask = ((room_seg == 2).astype(np.uint8) * 255)
    contours, _ = cv2.findContours(wall_mask, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    walls = []
    for contour in contours:
        if cv2.contourArea(contour) < 30:
            continue
        epsilon = max(3, .012 * cv2.arcLength(contour, True))
        points = cv2.approxPolyDP(contour, epsilon, True).reshape(-1, 2).tolist()
        if len(points) >= 2:
            walls.append({"points": points})
    furniture = []
    for label, name in [(3, "Closet"), (5, "Toilet"), (6, "Sink")]:
        mask = ((icon_seg == label).astype(np.uint8) * 255)
        components, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for contour in components:
            x, y, w, h = cv2.boundingRect(contour)
            if w * h >= 20:
                furniture.append({"name": name, "x": x + w / 2, "y": y + h / 2, "width": w, "depth": h})
    return {"width": size[1], "height": size[0], "walls": walls, "furniture": furniture}


@app.get("/health")
def health():
    return {"ready": WEIGHTS_PATH.exists(), "device": str(device)}


@app.post("/api/reconstruct")
async def reconstruct(file: UploadFile = File(...)):
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(415, "Upload a PNG, JPG, or WEBP floorplan image.")
    pixels, tensor = prepare_image(await file.read())
    prediction, size = infer(tensor)
    result = vectors_from_prediction(prediction, size)
    result["source_width"] = int(pixels.shape[1])
    result["source_height"] = int(pixels.shape[0])
    return result
