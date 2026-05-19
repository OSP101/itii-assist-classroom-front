import { redirect } from "next/navigation";

interface ClassroomExamSeatsPageProps {
    params: Promise<{
        id: string;
    }>;
}

export default async function ClassroomExamSeatsPage({ params }: ClassroomExamSeatsPageProps) {
    const { id } = await params;
    redirect(`/classroom/${id}/overview`);
}
