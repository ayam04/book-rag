# Book RAG Using Gemini Vision and OpenAI cl100k_base

A full-stack application built with a Next.js frontend and a Python backend. The frontend utilizes modern UI libraries and tools, while the backend is designed to handle data processing and API requests.

## Frontend

The frontend is built using Next.js, a React framework that enables server-side rendering and static site generation. It leverages Tailwind CSS for styling and includes various UI components.

### Key Features

- **Next.js**: Provides a robust framework for building React applications with server-side rendering.
- **Tailwind CSS**: Utilized for styling, offering a utility-first CSS framework.
- **Radix UI**: A set of accessible, unstyled UI components for building high-quality design systems and web apps.

### Installation

1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```

### Scripts

- `dev`: Starts the development server.
- `build`: Builds the application for production.
- `start`: Starts the production server.
- `lint`: Runs ESLint to check for code quality issues.

### Configuration

- **Tailwind CSS**: Configured in `tailwind.config.ts`.
- **Components**: Defined in `components.json` with aliases for easy imports.

## Backend

The backend is built using Python and provides API endpoints for the frontend to interact with. It includes functionalities for data processing and image extraction from PDFs.

### Key Features

- **FastAPI**: Used for building the .
- **FAISS**: Used for dense vector clustering.
- **OpenAI API**: For endcoding and text generation models.
- **Gemini API**: For Vision tasks, i.e., reading images.
- **Fitz**: For PDF Text and Image Extraction

### Installation

1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Create a virtual environment:
   ```bash
   python -m venv venv
   ```
3. Activate the virtual environment:
   - On Windows:
     ```bash
     .\venv\Scripts\activate
     ```
   - On macOS/Linux:
     ```bash
     source venv/bin/activate
     ```
4. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

### Running the Application

- Start the backend server:
  ```bash
  python app.py
  ```

### Environment Variables

- **OPENAI_API_KEY**: Required for OpenAI API access.
- **GEMINI_API_KEY**: Required for Google GenAI access.
