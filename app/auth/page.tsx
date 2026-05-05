import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import EmailPassword from "./EmailPassword";

export default function AuthPage() {
    const supabase = await createSupabaseServerClient()
    const {
        data: { user },
    } = await supabase.auth.getUser();

    return <EmailPassword user={ null }/>;
}