import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@iconify/react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { DocsArticleActions } from "@/components/support/DocsArticleActions";
import { DocsArticleFeedback } from "@/components/support/DocsArticleFeedback";
import { PublicPageShell } from "@/components/support/PublicPageShell";
import { docsCategoryGroups } from "@/config/docs-categories";
import { getAllDocs, getDocBySlug, getDocsByCategory, getDocsNeighbors } from "@/lib/docs.server";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  const docsArticles = getAllDocs();
  return docsArticles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getDocBySlug(slug);

  if (!article) {
    return {
      title: "ไม่พบบทความ | ITII Assist Classroom",
    };
  }

  return {
    title: `${article.title} | คู่มือการใช้งาน`,
    description: article.description,
  };
}

export default async function DocsArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = getDocBySlug(slug);

  if (!article) {
    notFound();
  }

  const category = docsCategoryGroups.find((group) => group.key === article.category);
  const neighbors = getDocsNeighbors(article.slug);
  const relatedArticles = article.related
    .flatMap((relatedSlug) => {
      const relatedArticle = getDocBySlug(relatedSlug);
      return relatedArticle ? [relatedArticle] : [];
    })
    .slice(0, 3);

  return (
    <PublicPageShell
      eyebrow="Documentation"
      title={article.title}
      description={article.description}
      icon={article.icon}
      backHref="/docs"
      backLabel="กลับหน้าคู่มือ"
      actions={<DocsArticleActions />}
      heroPanel={
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="text-[11px] font-medium uppercase tracking-widest text-slate-400">Category</div>
            <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
              {category ? <Icon icon={category.icon} className="text-base text-blue-600" /> : null}
              {article.categoryLabel}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="text-[11px] font-medium uppercase tracking-widest text-slate-400">Audience</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{article.audience}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="text-[11px] font-medium uppercase tracking-widest text-slate-400">Updated</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{article.updatedAt}</div>
            <p className="mt-1 text-xs text-slate-500">เวลาอ่านประมาณ {article.readingTime}</p>
          </div>
        </div>
      }
    >
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_260px]">
        <main className="min-w-0">
          <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <Link href="/docs" className="font-medium hover:text-slate-900">
              คู่มือ
            </Link>
            <Icon icon="solar:alt-arrow-right-linear" className="text-base text-slate-300" />
            {category ? <span className="font-medium text-slate-700">{category.title}</span> : null}
          </nav>

          {article.category === "policy" ? (
            <div className="mb-8 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-7 text-blue-950">
              <div className="mb-1 flex items-center gap-2 font-semibold">
                <Icon icon="solar:info-circle-bold-duotone" className="h-5 w-5" />
                หมายเหตุด้านข้อกำหนด
              </div>
              เนื้อหานี้จัดทำเพื่ออธิบายแนวทางการใช้งานระบบและมาตรการภายในให้ผู้ใช้เข้าใจง่าย
              ไม่ใช่คำปรึกษากฎหมายเฉพาะกรณี หากจะใช้เป็นประกาศหรือข้อกำหนดอย่างเป็นทางการขององค์กร
              ควรให้ผู้รับผิดชอบด้านกฎหมายตรวจทานฉบับสุดท้ายก่อนเผยแพร่
            </div>
          ) : null}

          {/* Mobile TOC */}
          <div className="mb-8 rounded-xl border border-slate-200 bg-slate-50 p-4 xl:hidden">
            <h2 className="text-sm font-semibold text-slate-900">หัวข้อในบทความนี้</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {article.sections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-blue-200 hover:text-blue-700"
                >
                  {section.title}
                </a>
              ))}
            </div>
          </div>

          <article className="prose prose-slate prose-blue max-w-none prose-headings:scroll-mt-24 prose-headings:font-semibold prose-p:leading-8 prose-li:leading-8">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
              h2: ({node, ...props}) => {
                const text = props.children?.toString() || '';
                const id = text.toLowerCase().replace(/[^\w\s\u0E00-\u0E7F-]/g, '').replace(/[\s_]+/g, '-');
                return <h2 id={id} {...props} />
              },
              h3: ({node, ...props}) => {
                const text = props.children?.toString() || '';
                const id = text.toLowerCase().replace(/[^\w\s\u0E00-\u0E7F-]/g, '').replace(/[\s_]+/g, '-');
                return <h3 id={id} {...props} />
              }
            }}>
              {article.content}
            </ReactMarkdown>
          </article>

          {relatedArticles.length > 0 ? (
            <section className="mt-12 border-t border-slate-200 pt-8">
              <h2 className="text-lg font-semibold text-slate-900">บทความที่เกี่ยวข้อง</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {relatedArticles.map((item) => (
                  <Link
                    key={item.slug}
                    href={`/docs/${item.slug}`}
                    className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-blue-200 hover:bg-blue-50/40"
                  >
                    <span className="block text-sm font-semibold text-slate-900">{item.title}</span>
                    <span className="mt-2 block text-sm leading-6 text-slate-600">{item.description}</span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <DocsArticleFeedback articleTitle={article.title} />

          <nav className="mt-12 grid gap-3 border-t border-slate-200 pt-8 sm:grid-cols-2">
            {neighbors.previous ? (
              <Link
                href={`/docs/${neighbors.previous.slug}`}
                className="rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-blue-200 hover:bg-blue-50/40"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-slate-500">
                  <Icon icon="solar:arrow-left-linear" className="h-4 w-4" />
                  ก่อนหน้า
                </span>
                <span className="mt-2 block font-semibold text-slate-900">{neighbors.previous.title}</span>
              </Link>
            ) : (
              <span />
            )}

            {neighbors.next ? (
              <Link
                href={`/docs/${neighbors.next.slug}`}
                className="rounded-xl border border-slate-200 bg-white p-4 text-right transition hover:border-blue-200 hover:bg-blue-50/40"
              >
                <span className="flex items-center justify-end gap-2 text-sm font-medium text-slate-500">
                  ถัดไป
                  <Icon icon="solar:arrow-right-linear" className="h-4 w-4" />
                </span>
                <span className="mt-2 block font-semibold text-slate-900">{neighbors.next.title}</span>
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </main>

        <aside className="hidden xl:block">
          <div className="sticky top-24 rounded-xl border border-slate-200 bg-slate-50/50 p-5">
            <h2 className="text-sm font-semibold text-slate-900">หัวข้อในบทความนี้</h2>
            <nav className="mt-4 flex flex-col gap-2.5">
              {article.sections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="text-sm font-medium text-slate-500 transition hover:text-slate-900"
                  style={{ paddingLeft: `${(section.level - 2) * 1}rem` }}
                >
                  {section.title}
                </a>
              ))}
            </nav>
          </div>
        </aside>
      </div>
    </PublicPageShell>
  );
}
