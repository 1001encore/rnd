export interface Env { }

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        // --- CORS HEADERS (Standard) ---
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        };

        if (request.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        const url = new URL(request.url);
        const ticker = url.searchParams.get("ticker") || "SPY";
        const date = url.searchParams.get("date");

        // --- THE FIX: CRUMB HANDSHAKE ---
        try {
            // 1. Get a Session Cookie
            // We hit the main page to get the 'Set-Cookie' header
            const cookieReq = await fetch("https://fc.yahoo.com", {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                }
            });

            const setCookie = cookieReq.headers.get("set-cookie");
            if (!setCookie) throw new Error("Yahoo blocked cookie generation.");

            // 2. Get the Crumb
            // We use the cookie to ask Yahoo for a valid token
            const crumbReq = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
                headers: {
                    "Cookie": setCookie,
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                }
            });

            const crumb = await crumbReq.text();
            if (!crumb) throw new Error("Yahoo blocked crumb generation.");

            // 3. Fetch the ACTUAL Data (Using Cookie + Crumb)
            let yahooUrl = `https://query1.finance.yahoo.com/v7/finance/options/${ticker}?crumb=${crumb}`;
            if (date) yahooUrl += `&date=${date}`;

            const dataReq = await fetch(yahooUrl, {
                headers: {
                    "Cookie": setCookie,
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                }
            });

            const data = await dataReq.json();

            return new Response(JSON.stringify(data), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });

        } catch (e: any) {
            return new Response(JSON.stringify({ error: "Yahoo Handshake Failed", details: e.message }), {
                status: 500,
                headers: corsHeaders
            });
        }
    },
};