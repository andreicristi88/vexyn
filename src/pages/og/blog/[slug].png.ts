import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { generateOpenGraphImage } from 'astro-og-canvas';

export async function getStaticPaths() {
  const posts = await getCollection('blog');
  return posts.map((post) => ({
    params: { slug: post.id.replace(/\.md$/, '') },
    props: {
      title: post.data.title,
      description: post.data.description,
    },
  }));
}

export const GET: APIRoute = async ({ props }) => {
  const { title, description } = props as { title: string; description: string };
  const body = await generateOpenGraphImage({
    title,
    description,
    bgGradient: [
      [10, 10, 20],
      [25, 25, 50],
    ],
    border: { color: [99, 102, 241], width: 6, side: 'inline-start' },
    padding: 60,
    font: {
      title: {
        size: 56,
        weight: 'Bold',
        color: [240, 240, 250],
        lineHeight: 1.15,
      },
      description: {
        size: 26,
        color: [160, 160, 180],
        lineHeight: 1.4,
      },
    },
    logo: {
      path: './public/logo-shield-512.png',
      size: [60],
    },
  });
  return new Response(body, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
};
