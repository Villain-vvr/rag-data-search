# RAG Data Search

This application is a powerful, web-based tool that implements Retrieval-Augmented Generation (RAG) to search through any structured dataset (JSON or CSV) using natural language queries. It's powered by the Google Gemini API.

You can load data from a URL, a public GitHub repository, or by uploading a local file, making it a versatile tool for data exploration and analysis.

## Features

- **Retrieval-Augmented Generation (RAG):** Provides more accurate, context-aware answers by first retrieving relevant data and then using an AI model to generate a summary.
- **Flexible Data Loading:**
  - Load data from any public URL (`.json` or `.csv`).
  - Load data directly from a public GitHub file URL.
  - Upload local `.json` or `.csv` files.
- **Data-Agnostic:** Works with any array of JSON objects or any CSV file, automatically adapting to the data's structure.
- **AI-Powered Search:** Leverages the Gemini API to understand natural language queries and provide insightful answers based on the provided data.
- **Responsive UI:** Clean, modern, and easy-to-use interface built with Tailwind CSS.

## How to Run Locally

This project is built without a traditional build step, using modern browser features like import maps.

1.  **No Installation Needed:** There are no `npm` packages to install.
2.  **Serve the Directory:** You need to serve the project files from a local web server. The easiest way is to use a tool like `serve` or the "Live Server" extension in VS Code.
3.  **Set API Key:** The application requires a Google Gemini API key. Since there's no `.env` file for this simple setup, you'll need to ensure the `API_KEY` is available in the environment where the app is hosted (see Vercel instructions).

## Deployment on Vercel

This project is ready to be deployed directly to Vercel.

### Step 1: Push to GitHub

Push your project folder to a new repository on your GitHub account.

### Step 2: Import Project on Vercel

1.  Log in to your [Vercel](https://vercel.com) account.
2.  Click "Add New..." -> "Project".
3.  Import the GitHub repository you just created.

### Step 3: Configure the Project

Vercel will likely ask for configuration. Use the following settings:

- **Framework Preset:** Select **Other**.
- **Build Command:** Leave this **blank** or toggle the override switch and leave it empty.
- **Output Directory:** Leave this as **.(Public)** or toggle the override and set it to the root directory (it should default to this).

### Step 4: Add Environment Variable (Crucial!)

Before deploying, you must add your Gemini API key as an environment variable.

1.  In the project configuration screen, go to the **Environment Variables** section.
2.  Add a new variable:
    - **Name:** `API_KEY`
    - **Value:** Paste your Google Gemini API key here.
3.  Make sure the variable is available to your Production, Preview, and Development environments.
4.  Click **Deploy**.

Your application will be built and deployed. You can now access your live RAG Data Search web app!
