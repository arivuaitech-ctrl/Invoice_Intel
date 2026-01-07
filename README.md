# InvoiceIntel - AI Expense Tracker

Smart expense tracking for professionals. Uses Google Gemini AI to extract data from invoices and receipts.

## Getting Started

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Set Environment Variables:**
    Create a `.env` file in the root and add:
    ```env
    API_KEY=your_gemini_api_key
    SUPABASE_URL=your_supabase_url
    SUPABASE_ANON_KEY=your_supabase_anon_key
    STRIPE_SECRET_KEY=your_stripe_secret_key
    ```

3.  **Run Locally:**
    ```bash
    npm run dev
    ```

## Deployment

This app is optimized for deployment on **Vercel**. Simply connect your GitHub repository to Vercel and it will handle the API routes automatically.