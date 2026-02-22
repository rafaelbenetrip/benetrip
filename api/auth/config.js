/**
 * API Route: /api/auth/config
 * Retorna configuração pública do Supabase
 * (anon key é projetada para ser pública, mas servir via API é mais limpo)
 */
export default function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        return res.status(503).json({ 
            error: 'Supabase not configured',
            message: 'Auth service unavailable' 
        });
    }

    return res.status(200).json({
        supabaseUrl,
        supabaseAnonKey
    });
}
