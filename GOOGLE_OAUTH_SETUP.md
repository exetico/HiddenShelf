# Google OAuth Setup Instructions

## 1. Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Configure OAuth consent screen:
   - Go to "APIs & Services" > "OAuth consent screen"
   - Choose "External" (unless you have a Google Workspace)
   - Fill in the required fields (App name, User support email, Developer contact)
   - Click "Save and Continue"
   - You can skip adding scopes (default email and profile scopes are sufficient)
   - Add test users if you want (optional during development)
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Web application"
   - Add authorized redirect URIs:
     - `https://yourdomain.com/api/auth/google/callback` (production: your `SITE_URL` + `/api/auth/google/callback`)
     - `http://localhost:3000/api/auth/google/callback` (local development)
     - Older PHP versions used `/api/auth/google-callback.php`. That URL no longer exists, so replace it if it's still registered or in your `.env`.
   - Copy the Client ID and Client Secret

## 2. Configure Environment Variables

Create a `.env` file in the project root (copy from `.env.example`):

```bash
GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=   # leave empty: {SITE_URL}/api/auth/google/callback
```

To use Google as the only login, also set `EMAIL_LOGIN_ENABLED=false`. No SMTP is needed then.

## 3. Restart

```bash
make up
```

## 4. Test the Integration

1. Visit `http://localhost:3000`
2. Click "Sign in with Google"
3. Authorize the application
4. You should be redirected back and logged in

## Notes

- If a user with the same email already exists, it will link the Google account to that user
- Otherwise, it creates a new user account
- Sessions work the same way as magic link authentication (30-day token)
