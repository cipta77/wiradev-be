# Hi-Fi Express Backend 🚀

This is the backend API for the Hi-Fi project, built with Express.js, TypeScript, and MySQL.

## Prerequisites
- Node.js (v18 or higher)
- pnpm (installed via `npm install -g pnpm`)
- MySQL Database (via Docker **OR** XAMPP)

---

## 🛠️ Setup Instructions

### 1. Install Dependencies
Clone this repository and install the dependencies using pnpm:
```bash
pnpm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Make sure to adjust the values inside `.env` depending on whether you are running via Docker or XAMPP.

---

## 🚀 Running the Database & Server

You can run the MySQL database using either **Docker** or **XAMPP**. Choose **one** of the methods below:

### Method A: Using Docker (Recommended)
Docker will automatically spin up MySQL and phpMyAdmin, and it will automatically run the initial database schema.

1. **Start Docker services**:
   ```bash
   docker compose up -d
   ```
   *This starts MySQL on port 3306 and phpMyAdmin on port 8080.*
   
2. **Start the backend server**:
   ```bash
   pnpm dev
   ```

### Method B: Using XAMPP
If you prefer not to use Docker, you can use XAMPP to run MySQL.

1. **Start XAMPP**: 
   Open XAMPP Control Panel and start **Apache** and **MySQL**.
2. **Create Database**:
   - Open your browser and go to `http://localhost/phpmyadmin`
   - Create a new database named `hifi_db` (or whatever `DB_NAME` is set to in your `.env`).
3. **Import Schema**:
   - Select the newly created database.
   - Go to the **Import** tab.
   - Choose the file `./db/init.sql` from this repository and click **Import**.
4. **Configure `.env` for XAMPP**:
   Make sure your `.env` matches your XAMPP credentials (usually user `root` and empty password):
   ```env
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=hifi_db
   ```
5. **Start the backend server**:
   ```bash
   pnpm dev
   ```

---

## 📚 API Documentation

Once the server is running, you can view the interactive Swagger UI documentation at:
👉 **[http://localhost:3000/docs](http://localhost:3000/docs)** *(assuming server runs on port 3000)*

## 🛠️ Useful Commands

- `pnpm dev`: Starts the server in development mode with auto-reload (tsx).
- `docker compose down`: Stops and removes the Docker containers.
