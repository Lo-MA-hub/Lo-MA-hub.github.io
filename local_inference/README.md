# Local Floorplan-to-3D Service

Run this from `C:\8_personal_website\local_inference` after the dependencies in
`requirements-local.txt` have been installed:

```powershell
C:\Users\happy\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8000
```

Then open `floorplan.html` and upload a PNG, JPG, or WEBP floorplan. The service
uses the original CubiCasa5K checkout and the locally stored model checkpoint;
neither is copied into this repository.
