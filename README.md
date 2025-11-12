# Manga-ULM (Ultimate Local Manager)

Manga-ULM is a powerful, locally-hosted manager for your digital manga collection. It's built with a Python/Flask backend and a modern Vue.js frontend, focusing on performance, robust data management, and a great user experience.

This project was bootstrapped based on a detailed design document. It currently provides a solid foundation with core features implemented and placeholders for advanced functionalities.

## Core Principles

*   **Database as the Single Source of Truth**: All application operations rely on the database record. The file system's state (like filenames) is a reflection of the metadata, not the source of authority.
*   **File Hash as the Unique Identifier**: A file's SHA-256 hash is its permanent ID. This means all associated metadata (tags, progress, etc.) remains linked even if the file is renamed or moved.

## Current Features

*   **Python/Flask Backend**: A robust server using an application factory pattern.
*   **Vue.js Frontend**: A responsive and modern UI built with Vite, Vue 3, Pinia, and Tailwind CSS.
*   **Database**: SQLite with SQLAlchemy ORM and Flask-Migrate for schema management.
*   **Asynchronous Task Processing**: Uses Huey for long-running tasks like library scanning.
*   **Real-time Updates**: Employs WebSockets (Flask-SocketIO) to provide live feedback for tasks like scanning.
*   **Core Library Scanning**: The backend can scan a specified directory, hash files, extract metadata, and store it in the database.
*   **Interactive Frontend**: The UI can trigger the library scan and display real-time progress.
*   **Placeholder UI/API**: Basic structure for advanced features like the manga reader, tagging system, data maintenance, and settings are in place.
*   **Advanced Library Navigation**: Rich filtering (tags, reading status, likes), natural keyword search, AND/OR tag modes, and nine sorting options power both grid and list presentations for large collections.
*   **At-a-glance Insights**: A library overview dashboard surfaces key metrics (totals, size, top tags) and highlight reels (recently added/read, largest files) powered by the new `/api/v1/files/stats` endpoint.
*   **In-place Reading Controls**: Cards now expose progress bars, status cycling, quick status buttons, and instant like toggles that sync through new backend APIs.

## Getting Started

### Prerequisites

*   **Python 3.8+** and `pip`
*   **Node.js 16+** and `npm`
*   **(Optional) `unrar` and `7z` command-line tools**: Required for scanning `.rar` and `.7z` archives. Make sure they are available in your system's PATH.
    *   **Windows**: Download from [7-Zip](https://www.7-zip.org/) and [WinRAR](https://www.rarlab.com/download.htm) (you only need `unrar.exe`).
    *   **macOS**: `brew install p7zip unrar`
    *   **Linux (Debian/Ubuntu)**: `sudo apt-get install p7zip-full unrar`

### Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd manga-ulm
    ```

### Backend Setup

1.  **Navigate to the backend directory:**
    ```bash
    cd backend
    ```

2.  **Create and activate a virtual environment:**
    ```bash
    python -m venv venv
    # On Windows
    venv\Scripts\activate
    # On macOS/Linux
    source venv/bin/activate
    ```

3.  **Install Python dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Initialize and upgrade the database:**
    The first time you set up the project, you need to create the database based on the models.
    ```bash
    flask db init  # Only run this the very first time
    flask db migrate -m "Initial migration."
    flask db upgrade
    ```
    For subsequent model changes, you will only need to run the `migrate` and `upgrade` commands.

### Frontend Setup

1.  **Navigate to the frontend directory:**
    ```bash
    cd ../frontend
    ```

2.  **Install Node.js dependencies:**
    ```bash
    npm install
    ```

### Running the Application

You need to run the backend and frontend servers in two separate terminals.

1.  **Start the Backend Server:**
    *   Make sure you are in the `backend` directory with the virtual environment activated.
    *   The `huey` task consumer must be running to process background jobs.
    ```bash
    # Terminal 1: Run the Huey consumer
    huey_consumer main.huey
    ```
    ```bash
    # Terminal 2: Run the Flask server
    flask run
    ```
    The backend API will be available at `http://127.0.0.1:5000`.

2.  **Start the Frontend Development Server:**
    *   Make sure you are in the `frontend` directory.
    ```bash
    # Terminal 3: Run the Vite dev server
    npm run dev
    ```
The application will be accessible at `http://127.0.0.1:5173` (or another port if 5173 is busy).

## Library API Enhancements

Key endpoints powering the new library experience:

* **`GET /api/v1/files`** – Supports keyword search, tag filters with `tag_mode=any|all`, multi-status filtering (`statuses=unread,finished`), like filtering (`liked=true|false`), page/size ranges, and expanded sort options such as `sort_by=last_read_date` or `sort_by=file_size`.
* **`GET /api/v1/files/stats`** – Returns totals, status breakdowns, top tags, and highlight lists that drive the dashboard tiles in the frontend.
* **`POST /api/v1/files/<id>/status`** – Quickly set `unread`, `in_progress`, or `finished` states (optionally with a `page` payload) to keep progress in sync without opening the reader.

## Production Deployment

For a production environment, it's recommended to use a robust web server like Nginx to serve the frontend and proxy requests to the backend. The `start.bat` script is configured to use `gunicorn` for a more performant backend server.

1.  **Build the Frontend:**
    *   Navigate to the `frontend` directory.
    *   Run the build command to generate optimized static assets in the `dist` directory.
    ```bash
    npm run build
    ```

2.  **Run Backend Services:**
    *   Use the provided `start.bat` script from the project root. It will launch the Gunicorn server and the Huey worker.
    ```bash
    ./start.bat
    ```

3.  **Configure Nginx:**
    *   Install Nginx on your server.
    *   Use a configuration similar to `nginx.conf.example` (located in the root of this project). You will need to update the `server_name` and the `root` path to your project's `frontend/dist` directory.
    *   This configuration will serve the static frontend files and correctly proxy API and WebSocket requests to the Gunicorn backend.

## Next Steps

This project is now at a stage where individual features can be built out. The next steps would be to replace the placeholder components and API endpoints with full functionality, following the specifications in the design document. Key areas include:

*   **Metadata Enrichment**: Pull series/author data from external sources and surface it alongside the existing tags.
*   **Smart Collections**: Allow users to save filter presets (e.g., “Unread Romance”) and surface them in navigation.
*   **Reading Experience Refinements**: Extend the reader with per-device preferences, preloading strategies, and offline caching.
*   **Automated Maintenance**: Expose scheduling for rescans, integrity checks, and stale file audits directly from the UI.
*   **Multi-user Support**: Add authentication and per-user progress so households can share a single library safely.
