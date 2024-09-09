from app import app

if __name__ == "__main__":
    import platform
    if platform.system() == "Windows":
        from waitress import serve
        serve(app, host="0.0.0.0", port=5000)
    else:
        app.run()