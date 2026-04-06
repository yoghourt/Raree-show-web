import { redirect } from "next/navigation"
import { supabase } from "@/lib/supabase"

interface Props {
  params: Promise<{ workId: string }>
}

export default async function WorkRedirectPage({ params }: Props) {
  const { workId } = await params

  const { data: work } = await supabase
    .from("works")
    .select("id")
    .eq("tsid", workId)
    .maybeSingle()

  if (!work) redirect("/")

  const { data: scenes, error } = await supabase
    .from("scenes")
    .select("tsid")
    .eq("work_id", work.id)
    .order("order_index", { ascending: true })
    .limit(1)

  if (error || !scenes?.length) redirect("/")

  redirect(`/works/${workId}/scenes/${scenes[0].tsid}`)
}
