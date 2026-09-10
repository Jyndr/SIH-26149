import uvicorn


if __name__ == "__main__":
    uvicorn.run("native_agent.main:app", host="127.0.0.1", port=8765)

