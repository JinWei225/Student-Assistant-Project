# AskA Website — Setup Guide

> [!NOTE]
> This project is shared for reference only. See the [main README](../README.md) for details.

This project is a support chat and ticket submission website for students. It integrates an AI-powered chat system with a backend ticketing system, using Node.js for the server and n8n for automated workflows.

---

# Setup AskA Website

## 🛠️ Prerequisites

Before you begin, ensure you have the following installed on your **Windows** or **macOS** machine:

1.  **Node.js (v16 or higher)**: [Download here](https://nodejs.org/) or use Homebrew on macOS (`brew install node`).
2.  **Python 3.10+ & Pip**: [Download here](https://www.python.org/downloads/) or use Homebrew on macOS (`brew install python`).
3.  **MySQL Server & Workbench**: 
    - **Windows**: [MySQL Community Server](https://dev.mysql.com/downloads/mysql/) and [MySQL Workbench](https://dev.mysql.com/downloads/workbench/).
    - **macOS**: `brew install mysql` and start with `brew services start mysql`.

---

## 🐘 MySQL Database Setup

The application uses two separate databases: `Chat` (for user accounts and session history) and `company_reports` (for helpdesk tickets).

### 1. Launch MySQL Server
-   **Windows**: Ensure the MySQL service is running on your machine (this usually starts automatically after installation).
-   **macOS**: Start the service via terminal: `brew services start mysql`.

### 2. Access the Database
-   **Windows**: Open **MySQL Workbench** and connect to your local instance.
-   **macOS**: You can use **MySQL Workbench (Recommended)**, **Sequel Ace**, or the command line (`mysql -u root`).
-   In your preferred tool, open a **New SQL Tab** and run the following commands to create the databases:

```sql
-- Create the first database for chat history and User accounts
CREATE DATABASE IF NOT EXISTS chat;

-- Create the second database for Department/Helpdesk reports
CREATE DATABASE IF NOT EXISTS company_reports;
```

### 3. Create Tables
Run these scripts within their respective databases:

#### For `chat` database:
```sql
USE chat;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_sessions (
    id VARCHAR(255) PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255),
    timestamp VARCHAR(50),
    messages JSON,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS submitted_forms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    department VARCHAR(100),
    category VARCHAR(100),
    block_room VARCHAR(100),
    campus_id VARCHAR(100),
    question TEXT,
    name VARCHAR(100),
    email VARCHAR(100),
    attachment_path VARCHAR(255),
    timestamp VARCHAR(50),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
```

#### For `company_reports` database:
```sql
USE company_reports;

CREATE TABLE workers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    department VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    department VARCHAR(100) NOT NULL,
    block_room_no VARCHAR(50) DEFAULT NULL,
    student_id VARCHAR(20) NOT NULL,
    student_name VARCHAR(100) NOT NULL,
    student_email VARCHAR(100) NOT NULL,
    student_telephone VARCHAR(20) DEFAULT NULL,
    issue_category VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    status ENUM('PENDING', 'ASSIGNED', 'RESOLVED') DEFAULT 'PENDING',
    
    worker_id INT DEFAULT NULL,
    
    start_time DATETIME NULL DEFAULT NULL,
    duration INT DEFAULT NULL COMMENT 'Duration in minutes',
    end_time DATETIME GENERATED ALWAYS AS (start_time + INTERVAL duration MINUTE) VIRTUAL,
    last_broadcasted_at TIMESTAMP NULL DEFAULT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE SET NULL
);

INSERT INTO workers (full_name, email, department, is_active) VALUES
('Worker One', 'worker1@example.com', 'IT', TRUE),
('Worker Two', 'worker2@example.com', 'IT', TRUE),
('Worker Three', 'worker3@example.com', 'IT', TRUE),
('Worker Four', 'worker4@example.com', 'IT', TRUE);
```
These rows are placeholders. Replace them with real worker emails, because tickets are sent to these addresses. A worker's `department` must exactly match the department name used in the ticket form.

---

## ⚙️ Environment Configuration

1.  **Node Dependencies**:
    Open a terminal in this project root and run:
    ```bash
    npm install
    ```

2.  **Environment Variables (`.env`)**:
    Create a file named `.env` in the root directory, set your MySQL credentials and add a `JWT_SECRET`:
    ```env
    MYSQL_HOST=localhost
    MYSQL_PORT=3306
    MYSQL_USER=root
    MYSQL_PASSWORD=
    MYSQL_DATABASE=company_reports
    JWT_SECRET=
    ```

    Set `JWT_SECRET` to a long random value. The server won't start without it. To generate one:
    ```bash
    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
    ```

---

## 🤖 n8n Workflow Integration

The website sends information to n8n via Webhooks. You must update the webhook URLs based on the Webhook node in n8n in the following files to match your local setup:

1.  **`config.js`**: Update `N8N_WEBHOOK_URL` and `N8N_TICKET_WEBHOOK_URL`. To get the URL, open Student Info **Assistant workflow**, click the `Webhook` node, then copy the `Production URL`.
2.  **`server.js`**: Update `TICKET_WEBHOOK_URL` (line 172). To get the URL, open **OnSubmit** workflow, click the `Webhook` node, then copy the `Production URL`.

### Cases for Local n8n Hosting

#### Case A: Running n8n via NPM (Recommended for Windows)
1.  Install n8n: `npm install n8n -g`
2.  Start n8n: `n8n start`
3.  **Webhook Tip**: Use `http://localhost:5678/...` in `config.js` and `server.js`. 

#### Case B: Running n8n via Docker Desktop
1.  Run the n8n container:
    ```bash
    docker run -it --rm --name n8n -p 5678:5678 n8nio/n8n
    ```
2.  **Critical Tip**: If n8n needs to talk to the local MySQL server running on your Windows host, use the following host address:
    - **Host IP**: `host.docker.internal` (instead of `localhost`)
3.  **Webhook URLs**: If the main website is running outside of Docker and n8n is inside, use `http://localhost:5678/...` because the port is mapped.

---

## 🚀 Running the App

1.  Ensure MySQL is running.
2.  Run the Node.js server in the project root directory:
    ```bash
    node server.js
    ```
3.  Access the website:
    Open your browser and go to `http://localhost:3000`.

---

# Setup n8n Workflow

## Setup n8n Credentials

To run the workflow, you need to prepare the following credentials:

### 1. Google Workspace (Drive, Gmail, Calendar)
1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  **Create a Project** and search for/enable **Google Drive API**, **Gmail API**, and **Google Calendar API**.
3.  **Create Credentials** > **OAuth client ID** > **Web application**.
4.  **Authorized redirect URIs**: Copy the OAuth Redirect URL from your n8n Google node.
5.  Copy your **Client ID** and **Client Secret** into Google Drive, Gmail and Google Calendar node in n8n.
6. Click "Sign in to Google" button on the bottom of the node, select the Google account that you have used to create the Google Cloud project, click "Continue" and grant access to the node.

### 2. Supabase (Vector Database)
1.  In [Supabase](https://supabase.com/), open your project.
2.  Go to **Project Settings** > **Data API** (under Integrations).
3.  Copy the **API URL** and paste to the **Host** field in the n8n Supabase credentials.
4. Go to **Project Settings** > **API Keys** > **Legacy anon, service_role API keys**.
5. Copy the **service_role** and paste to the **Service Role Secret** field in the N8N Supabase credential. 

### 3. Ollama (AI)
1.  See [Ollama Credentials Docs](https://docs.n8n.io/integrations/builtin/credentials/ollama/?utm_source=n8n_app&utm_medium=credential_settings&utm_campaign=create_new_credentials_modal)

### 4. MySQL (Database)
1.  **Host**: `localhost` (or `host.docker.internal` if n8n is in Docker).
2.  **Port**: `3306`.
3.  **Database**: `company_reports`.
4.  **User**: `root` (default).
5.  **Password**: (your configured password).

---

## Ollama Local Models
In our workflow, we use the following models:
1. nomic-embed-text:latest (Embedding model)
2. ministral-3:3b (Query database and answer students' questions)
3. qwen3:8b (Estimate work duration for jobs and write emails to workers)

Please ensure that you have pulled these models above in Ollama before running the workflow.

```bash
ollama pull nomic-embed-text:latest
ollama pull ministral-3:3b
ollama pull qwen3:8b
```

---

## Supabase Vector Database

You need to setup the Supabase database for the Supabase node in n8n by creating a Supabase project (which you may have created to get the credentials above). Input the following command into the SQL editor of your project in Supabase:

```sql
-- 1. Enable the pgvector extension
create extension if not exists vector with schema extensions;

-- 2. Create the table with the correct 768 dimension
create table if not exists documents (
  id bigserial primary key,
  content text,           
  metadata jsonb,         
  embedding extensions.vector(768) 
);

-- 3. Create the search function for 768-dimension embeddings
create or replace function match_documents (
  query_embedding extensions.vector(768),
  match_count int DEFAULT null,
  filter jsonb DEFAULT '{}'
) returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where documents.metadata @> filter
  order by documents.embedding <=> query_embedding
  limit match_count;
end;
$$;
```

After that, go back to the **Student Info Assistant** workflow and select the "document" table in the "Table Name" field in the `Supabase Vector Store` and `Supabase Vector Store1` nodes.

---

## Get Started

1. Upload your own knowledge base document (PDF) to your Google Drive. No document is included in this repository.
2. Get the id of the file from the URL (e.g., https://drive.google.com/file/d/1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p/view?usp=sharing, the id is "1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p").
3. In the **Student Info Assistant** workflow, go to the `Download File` node.
4. Replace `YOUR_GOOGLE_DRIVE_FILE_ID` in the "File" field with the id you just copied.
5. Insert the information into Supabase Vector Database by clicking the "Execute Workflow" button beside `When clicking 'Execute Workflow'` trigger node at the left part of the **Student Info Assistant** workflow. Note that you only need to execute this once.
6. In the **OnReply** workflow, open the `Create an event1` node and select your own calendar in the "Calendar" field. It ships with the placeholder `your-calendar@example.com`.
7. Publish the **Student Info Assistant**, **OnSubmit** and **OnReply** workflows by clicking the "Publish" button at the top right corner of the n8n interface in each workflow.
8. You can go to the website and try to chat with the AI assistant and submit a ticket to the different department.

## Using the Website
Before executing step 3 and 4, make sure you have Setup n8n Workflow and published it (see [Setup n8n Workflow](#setup-n8n-workflow)). 
1. For first time user, you need to create an account first by clicking "Register" in the login page and create an account. 
2. Login with the account you just created.
3. You can start chatting with the AI assistant by typing your message in the chat box and click the send button.
4. You can also submit a ticket to the different department by clicking the "Submit a Form" button in the top right corner of the webpage. 
5. You are recommended to logout after using the website.