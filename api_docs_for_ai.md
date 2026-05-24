# 🚀 HI-FI Express Backend API Specifications for AI Context

> **AI INSTRUCTION**: This document contains the active and core API specifications for the **Hi-Fi Express Backend**. Use this context to generate frontend API integrations, models, forms, validation schemas, or tests. Only active and used endpoints are documented below.

---

## 📌 Global Specifications

- **Base URL**: `http://localhost:5000` (or configured via environment variables)
- **Content Type**: `application/json` (unless specified otherwise, e.g., Multipart Form-Data for uploads)
- **CORS Policy**: Enabled supporting credentials (cookies) dynamically for requesting origins, allowing standard HTTP methods and headers, and setting `Access-Control-Allow-Credentials: true`.
- **Standard Error Response**:
  ```json
  {
    "message": "Error description string"
  }
  ```
- **Authentication**: JWT HttpOnly cookie-based. Frontend requests must use `{ credentials: "include" }`. The server automatically issues and parses two cookies:
  - `access_token` (HttpOnly, secure in production, lax SameSite, 15m expiration)
  - `refresh_token` (HttpOnly, secure in production, lax SameSite, 7d expiration)

---

## 📊 Core Data Types & Schemas

### 1. User Object Schema (`User`)

This represents the safe user object returned in successful API responses (with `password_hash` omitted).

```typescript
interface User {
  id: string; // UUID
  email: string; // Unique email address
  username: string | null; // Optional unique username
  first_name: string | null; // User's first name
  last_name: string | null; // User's last name
  university: string | null; // University name
  field_of_study: string | null; // Study major/department
  graduation_year: number | null; // Graduation year (integer)
  avatar_url: string | null; // Link to user profile image
  achievement_goal: AchievementGoal | null; // Selected onboarding goal
  target_role: string | null; // Selected target role (e.g. Frontend Developer, Backend Developer, etc.)
  cv_url: string | null; // Link to uploaded CV file
  transcript_url: string | null; // Link to uploaded academic transcript
  onboarding_completed: boolean; // onboarding status flag
  is_email_verified: boolean; // Verification status
  created_at: string; // ISO 8601 Timestamp
  updated_at: string; // ISO 8601 Timestamp
}
```

### 2. `AchievementGoal` Enum

Used during the onboarding goal step.

```typescript
enum AchievementGoal {
  GET_FIRST_JOB = "GET_FIRST_JOB",
  SWITCH_DEVELOPER_ROLE = "SWITCH_DEVELOPER_ROLE",
  IMPROVE_CODING_SKILLS = "IMPROVE_CODING_SKILLS",
  PREPARE_INTERVIEWS = "PREPARE_INTERVIEWS",
  BUILD_PORTFOLIO = "BUILD_PORTFOLIO",
  UNDERSTAND_MARKET = "UNDERSTAND_MARKET",
}
```

---

## 🔑 Authentication Endpoints (`/api/auth`)

### 1. Register Account

Creates a new email-based user account and automatically returns session tokens.

- **Method**: `POST`
- **Path**: `/api/auth/register`
- **Request Body (JSON)**:
  ```json
  {
    "email": "user@example.com",
    "password": "securepassword123"
  }
  ```
- **Responses**:
  - **`201 Created`**: Successful registration
    ```json
    {
      "message": "Successfully registered and logged in",
      "result": {
        "user": {
          "id": "31f4ee77-628b-4ef9-bb6e-44d41113b2c1",
          "email": "user@example.com",
          "username": null,
          "first_name": null,
          "last_name": null,
          "university": null,
          "field_of_study": null,
          "graduation_year": null,
          "avatar_url": null,
          "achievement_goal": null,
          "cv_url": null,
          "transcript_url": null,
          "onboarding_completed": false,
          "is_email_verified": false,
          "created_at": "2026-05-18T08:00:00.000Z",
          "updated_at": "2026-05-18T08:00:00.000Z"
        }
      }
    }
    ```
  - **`400 Bad Request`**: Validation errors or pre-existing email
    ```json
    {
      "message": "Email and password are required"
    }
    ```

### 2. Login Account

Logs in an existing user using either their email or username.

- **Method**: `POST`
- **Path**: `/api/auth/login`
- **Request Body (JSON)**:
  ```json
  {
    "identifier": "user@example.com",
    "password": "securepassword123"
  }
  ```
- **Responses**:
  - **`200 OK`**: Successful authentication
    ```json
    {
      "message": "Successfully logged in",
      "result": {
        "user": { ...User }
      }
    }
    ```
  - **`400 Bad Request`**: Missing required parameters or incorrect credentials

### 3. Google OAuth Login / Register

Authenticates or registers a user via a Google OAuth ID Token. Supports conditional registration.

- **Method**: `POST`
- **Path**: `/api/auth/google`
- **Request Body (JSON)**:
  ```json
  {
    "idToken": "google_id_token_string...",
    "isSignUp": false // Optional. If true, registers a new account if not found. If false, throws an error if not found.
  }
  ```
- **Responses**:
  - **`200 OK`**: Successful Google OAuth login
    ```json
    {
      "message": "Successfully authenticated with Google",
      "result": {
        "user": { ...User }
      }
    }
    ```
  - **`400 Bad Request`**: Missing ID token or token validation failed

### 4. Refresh Tokens

Generates a new pair of access and refresh tokens via HttpOnly refresh cookie.

- **Method**: `POST`
- **Path**: `/api/auth/refresh`
- **Request Body (JSON)**:
  _(None - Sent automatically via HttpOnly cookie `refresh_token`)_
- **Responses**:
  - **`200 OK`**: Cookies refreshed successfully
    ```json
    {
      "message": "Tokens refreshed successfully"
    }
    ```
  - **`401 Unauthorized`**: Token has expired or is invalid

### 5. Get Current Session Profile

Retrieves the logged-in user's profile based on the `access_token` cookie (vital for page-load checks).

- **Method**: `GET`
- **Path**: `/api/auth/me`
- **Responses**:
  - **`200 OK`**: Session active, returns user profile
    ```json
    {
      "message": "Profile retrieved successfully",
      "result": { ...User }
    }
    ```
  - **`401 Unauthorized`**: No active session or token invalid

### 6. Logout Account

Clears secure cookies on the browser to sign the user out.

- **Method**: `POST`
- **Path**: `/api/auth/logout`
- **Responses**:
  - **`200 OK`**: Successfully logged out
    ```json
    {
      "message": "Successfully logged out"
    }
    ```

---

## 👤 User & Onboarding Endpoints (`/api/users`)

### 1. Get User Profile

Retrieves detailed profile data for a specific user ID.

- **Method**: `GET`
- **Path**: `/api/users/:id`
- **Path Parameters**:
  - `id`: `string` (UUID of the user)
- **Responses**:
  - **`200 OK`**: Profile retrieved successfully
    ```json
    {
      "message": "Profile retrieved successfully",
      "result": { ...User }
    }
    ```

### 2. Update Onboarding Profile

Updates the user's primary academic and profile information during the onboarding flow.

- **Method**: `PATCH`
- **Path**: `/api/users/:id/onboarding/profile`
- **Path Parameters**:
  - `id`: `string` (UUID of the user)
- **Request Body (JSON)**:
  ```json
  {
    "first_name": "Ubay",
    "last_name": "Dillah",
    "university": "Universitas Indonesia",
    "field_of_study": "Computer Science",
    "graduation_year": 2027
  }
  ```
- **Responses**:
  - **`200 OK`**: Profile updated successfully
    ```json
    {
      "message": "Profile updated successfully",
      "result": { ...User }
    }
    ```

### 3. Update Onboarding Goal

Sets the user's focus/objective from the available list of achievement goals.

- **Method**: `PATCH`
- **Path**: `/api/users/:id/onboarding/goal`
- **Path Parameters**:
- `id`: `string` (UUID of the user)
- **Request Body (JSON)**:
  ```json
  {
    "achievement_goal": "GET_FIRST_JOB"
  }
  ```
  _(Note: `achievement_goal` MUST be a valid value from the `AchievementGoal` Enum)._
- **Responses**:
  - **`200 OK`**: Goal updated successfully
    ```json
    {
      "message": "Goal updated successfully",
      "result": { ...User }
    }
    ```

### 4. Update Onboarding Role

Sets the user's targeted career path/role during onboarding.

- **Method**: `PATCH`
- **Path**: `/api/users/:id/onboarding/role`
- **Path Parameters**:
  - `id`: `string` (UUID of the user)
- **Request Body (JSON)**:
  ```json
  {
    "target_role": "Frontend Developer"
  }
  ```
- **Responses**:
  - **`200 OK`**: Role updated successfully
    ```json
    {
      "message": "Role updated successfully",
      "result": { ...User }
    }
    ```

### 5. Upload Onboarding Documents

Uploads CV and academic transcripts to the server database. Relies on `multer` file parsing.

- **Method**: `PATCH`
- **Path**: `/api/users/:id/onboarding/documents`
- **Path Parameters**:
  - `id`: `string` (UUID of the user)
- **Request Body (Multipart Form-Data)**:
  - `cv`: `File` (Optional, max 1 PDF/Doc/Image file)
  - `transcript`: `File` (Optional, max 1 PDF/Doc/Image file)
- **Responses**:
  - **`200 OK`**: Documents uploaded successfully
    ```json
    {
      "message": "Documents uploaded successfully",
      "result": { ...User }
    }
    ```

### 5.1. Upload Onboarding CV Only

Uploads the CV resume file only to the server.

- **Method**: `PATCH`
- **Path**: `/api/users/:id/onboarding/cv`
- **Path Parameters**:
  - `id`: `string` (UUID of the user)
- **Request Body (Multipart Form-Data)**:
  - `cv`: `File` (Required, max 1 PDF/Doc/Image file)
- **Responses**:
  - **`200 OK`**: CV uploaded successfully
    ```json
    {
      "message": "CV uploaded successfully",
      "result": { ...User }
    }
    ```

### 5.2. Upload Onboarding Transcript Only

Uploads the academic transcript file only to the server.

- **Method**: `PATCH`
- **Path**: `/api/users/:id/onboarding/transcript`
- **Path Parameters**:
  - `id`: `string` (UUID of the user)
- **Request Body (Multipart Form-Data)**:
  - `transcript`: `File` (Required, max 1 PDF/Doc/Image file)
- **Responses**:
  - **`200 OK`**: Transcript uploaded successfully
    ```json
    {
      "message": "Transcript uploaded successfully",
      "result": { ...User }
    }
    ```

### 6. Complete Onboarding Status

Marks the onboarding phase as complete, with an optional GitHub integration step.

- **Method**: `POST`
- **Path**: `/api/users/:id/onboarding/complete`
- **Path Parameters**:
  - `id`: `string` (UUID of the user)
- **Request Body (JSON)**:
  ```json
  {
    "githubId": "98765432"
  }
  ```
  _(Note: `githubId` is completely optional)._
- **Responses**:
  - **`200 OK`**: Onboarding marked complete
    ```json
    {
      "message": "Onboarding completed successfully",
      "result": { ...User }
    }
    ```

### 7. Update Account Settings (Profile)

Updates the user's primary account settings (First Name, Last Name, Email, and University) from the Account Settings screen.

- **Method**: `PATCH`
- **Path**: `/api/users/:id/profile`
- **Path Parameters**:
  - `id`: `string` (UUID of the user)
- **Request Body (JSON)**:
  ```json
  {
    "first_name": "Alex",
    "last_name": "Rahman",
    "email": "alex.rahman@email.com",
    "university": "Universitas Indonesia"
  }
  ```
- **Responses**:
  - **`200 OK`**: Account settings updated successfully
    ```json
    {
      "message": "Account settings updated successfully",
      "result": { ...User }
    }
    ```
  - **`400 Bad Request`**: Missing required parameters or email already registered by another account

### 8. Update Password (Security)

Updates the user's account password. If the user has an existing password, the correct current password must be provided.

- **Method**: `PUT`
- **Path**: `/api/users/:id/password`
- **Path Parameters**:
  - `id`: `string` (UUID of the user)
- **Request Body (JSON)**:
  ```json
  {
    "current_password": "oldsecurepassword123",
    "new_password": "newsecurepassword456"
  }
  ```
- **Responses**:
  - **`200 OK`**: Password updated successfully
    ```json
    {
      "message": "Password updated successfully",
      "result": { ...User }
    }
    ```
  - **`400 Bad Request`**: Incorrect current password, new password too short, or missing parameters

---

## 🩺 System & Utility Endpoints

### 1. Root Welcome Endpoint

Returns a friendly greeting, the current system timestamp, and key resource paths.

- **Method**: `GET`
- **Path**: `/`
- **Responses**:
  - **`200 OK`**:
    ```json
    {
      "message": "Welcome to the Hi-Fi Express Backend API 🚀",
      "status": "Healthy",
      "timestamp": "2026-05-18T08:57:00.000Z",
      "endpoints": {
        "health": "/health",
        "auth": "/api/auth",
        "users": "/api/users"
      }
    }
    ```

### 2. Health Status

Verifies the operational status of the Express server and its connection to the database.

- **Method**: `GET`
- **Path**: `/health`
- **Responses**:
  - **`200 OK`**: Services fully online
    ```json
    {
      "status": "UP",
      "timestamp": "2026-05-18T08:05:00.000Z",
      "uptime": 124.58,
      "services": {
        "server": "UP",
        "database": "UP"
      },
      "error": null
    }
    ```

### 3. Dashboard Summary

Retrieves the dashboard summary for the currently authenticated user, including their role, initials, streak, and readiness score.

- **Method**: `GET`
- **Path**: `/api/dashboard/summary`
- **Headers**: `Cookie: access_token=...`
- **Responses**:
  - **`200 OK`**:
    ```json
    {
      "message": "Dashboard summary retrieved successfully",
      "result": {
        "name": "Ubay Dillah",
        "role": "Frontend Developer",
        "initials": "UD",
        "streak": 3,
        "readinessScore": 62,
        "readinessTrend": "+8%"
      }
    }
    ```

### 4. Skill Gap Analysis

Retrieves the list of skill gaps between the user's current abilities and the requirements of their target role.

- **Method**: `GET`
- **Path**: `/api/readiness/skill-gap`
- **Headers**: `Cookie: access_token=...`
- **Responses**:
  - **`200 OK`**:
    ```json
    {
      "message": "Skill gap retrieved successfully",
      "result": [
        {
          "skill": "React",
          "current": 40,
          "required": 80,
          "demand": "High",
          "priority": "Critical"
        }
      ]
    }
    ```

### 5. Market Demand

Retrieves market demand trends for various skills.

- **Method**: `GET`
- **Path**: `/api/readiness/market-demand`
- **Headers**: `Cookie: access_token=...`
- **Responses**:
  - **`200 OK`**:
    ```json
    {
      "message": "Market demand retrieved successfully",
      "result": [
        {
          "rank": 1,
          "skill": "JavaScript",
          "jobs_count": 15000,
          "trend_score": 95,
          "bar_width": 95
        }
      ]
    }
    ```
