// app/api/metabase/token/route.ts
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { users } from "../../../../lib/users";

// Accept request so we can inspect query params (e.g. ?as=2)
export async function GET(request: Request) {
  try {
    // ✅ Await cookies() - Next.js 15+
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session_user_id");

    if (!sessionCookie) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const userId = sessionCookie.value;

    // 🔍 Buscar usuario en lib/users
    const user = users.find(u => String(u.id) === userId);

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Read optional 'as' param to allow using an alternate account for dashboards
    let asParam: string | null = null;
    try {
      const url = new URL(request.url);
      asParam = url.searchParams.get('as');
    } catch (e) {
      // ignore
    }

    // Also accept x-as header for cases where the caller sets it explicitly
    const headerAs = request.headers.get('x-as');
    if (!asParam && headerAs) {
      asParam = headerAs;
    }

    // Also accept cookie 'metabase_as' as a fallback (client can set this)
    try {
      const cookieStore = await cookies();
      const asCookie = cookieStore.get('metabase_as');
      if (!asParam && asCookie) {
        asParam = asCookie.value;
      }
    } catch (e) {
      // ignore cookie read errors
    }

    // Server-side debug logging to help trace which token is being returned
    // eslint-disable-next-line no-console
    console.log('[token route] sessionUserId=', userId, 'asParam=', asParam, 'requestUrl=', request.url);
    // eslint-disable-next-line no-console
    console.log('[token route] headers:', Object.fromEntries(request.headers.entries()));

    let tokenUser = user;

    // If as=2, attempt to use an alternate user whose email is localPart + '2' + domain
    if (asParam === '2') {
      const parts = user.email.split('@');
      if (parts.length === 2) {
        const aliasEmail = `${parts[0]}2@${parts[1]}`;
        const aliasUser = users.find(u => u.email === aliasEmail);
        if (aliasUser) {
          tokenUser = aliasUser;
          // eslint-disable-next-line no-console
          console.log('[token route] using alias user=', aliasUser.email);
        }
      }
    }

    // eslint-disable-next-line no-console
    console.log('[token route] signing token for=', tokenUser.email);

    const METABASE_SECRET = process.env.METABASE_JWT_SHARED_SECRET;
    if (!METABASE_SECRET) {
      return NextResponse.json(
        { error: "Missing METABASE_JWT_SHARED_SECRET" },
        { status: 500 }
      );
    }

    // 🔥 Payload dinámico desde `lib/users` (use tokenUser)
    const payload = {
      email: tokenUser.email,
      first_name: tokenUser.firstName,
      last_name: tokenUser.lastName,
      groups: [tokenUser.group],
      exp: Math.floor(Date.now() / 1000) + 60 * 10,
    };

    const token = jwt.sign(payload, METABASE_SECRET);

    // 👌 EL SDK SOLO ACEPTA ESTO
    return NextResponse.json({ jwt: token });

  } catch (err: any) {
    console.error("ERROR JWT TOKEN:", err);
    return NextResponse.json(
      { error: "Internal Server Error", details: err.message },
      { status: 500 }
    );
  }
}
