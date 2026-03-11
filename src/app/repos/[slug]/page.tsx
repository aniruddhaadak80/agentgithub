import { RepositoryDetailPage } from "@/components/repository-detail-page";

export default async function RepositoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <RepositoryDetailPage slug={slug} />;
}