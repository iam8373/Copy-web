import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CategoryView } from "@/components/CategoryView";
import { CATEGORIES } from "@/lib/types";

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ category: c.slug }));
}

export function generateMetadata({
  params,
}: {
  params: { category: string };
}): Metadata {
  const meta = CATEGORIES.find((c) => c.slug === params.category);
  return { title: meta ? `${meta.label} Markets — Predict` : "Predict" };
}

export default function CategoryPage({ params }: { params: { category: string } }) {
  const meta = CATEGORIES.find((c) => c.slug === params.category);
  if (!meta) notFound();
  return <CategoryView meta={meta} />;
}
