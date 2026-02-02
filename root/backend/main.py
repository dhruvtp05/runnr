from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class RouteRequest(BaseModel):
    distance: float
    difficulty: str
    latitude: float
    longitude: float

@app.get("/")
def read_root():
    return {"status": "Running AI Route Backend"}

@app.post("/generate-routes")
async def generate_routes(request: RouteRequest):
    return {
        "message": f"Generating a {request.distance}km {request.difficulty} route...",
        "routes": [] 
    }