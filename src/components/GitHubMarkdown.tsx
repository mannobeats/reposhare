"use client"

import type { Components } from "react-markdown"
import ReactMarkdown from "react-markdown"
import rehypeRaw from "rehype-raw"
import rehypeSanitize, { defaultSchema } from "rehype-sanitize"
import rehypeSlug from "rehype-slug"
import remarkGfm from "remark-gfm"

const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code || []), "className"],
    img: [
      ...(defaultSchema.attributes?.img || []),
      "src",
      "alt",
      "title",
      "width",
      "height",
    ],
    a: [
      ...(defaultSchema.attributes?.a || []),
      "href",
      "title",
      "target",
      "rel",
    ],
    td: [...(defaultSchema.attributes?.td || []), "align", "style"],
    th: [...(defaultSchema.attributes?.th || []), "align", "style"],
    input: [
      ...(defaultSchema.attributes?.input || []),
      "type",
      "checked",
      "disabled",
    ],
  },
  tagNames: [...(defaultSchema.tagNames || []), "input", "details", "summary"],
}

const components: Components = {
  h1: ({ children, ...props }) => (
    <h1
      className="text-2xl font-bold tracking-widest uppercase text-primary pb-3 mb-4 mt-6 first:mt-0 border-b border-primary/40"
      {...props}
    >
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2
      className="text-xl font-bold tracking-widest uppercase text-primary pb-2 mb-4 mt-6 border-b border-primary/40"
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3
      className="text-lg font-bold tracking-wide text-primary mb-3 mt-5"
      {...props}
    >
      {children}
    </h3>
  ),
  h4: ({ children, ...props }) => (
    <h4
      className="text-base font-bold tracking-wide text-primary mb-2 mt-4"
      {...props}
    >
      {children}
    </h4>
  ),
  h5: ({ children, ...props }) => (
    <h5
      className="text-sm font-bold tracking-wide text-primary mb-2 mt-4"
      {...props}
    >
      {children}
    </h5>
  ),
  h6: ({ children, ...props }) => (
    <h6
      className="text-xs font-bold tracking-widest uppercase text-primary/70 mb-2 mt-4"
      {...props}
    >
      {children}
    </h6>
  ),
  p: ({ children, ...props }) => (
    <p
      className="text-sm font-sans text-primary/80 leading-relaxed mb-4"
      {...props}
    >
      {children}
    </p>
  ),
  a: ({ href, children, ...props }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2 decoration-primary/30 hover:decoration-primary transition-colors"
      {...props}
    >
      {children}
    </a>
  ),
  strong: ({ children, ...props }) => (
    <strong className="font-bold text-primary" {...props}>
      {children}
    </strong>
  ),
  em: ({ children, ...props }) => (
    <em className="italic text-primary/70" {...props}>
      {children}
    </em>
  ),
  ul: ({ children, ...props }) => (
    <ul
      className="list-disc pl-6 mb-4 text-sm font-sans text-primary/80 space-y-1"
      {...props}
    >
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol
      className="list-decimal pl-6 mb-4 text-sm font-sans text-primary/80 space-y-1"
      {...props}
    >
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="leading-relaxed marker:text-primary/40" {...props}>
      {children}
    </li>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote
      className="border-l-2 border-primary/40 pl-4 my-4 text-primary/60 italic"
      {...props}
    >
      {children}
    </blockquote>
  ),
  code: ({ children, className, ...props }) => {
    const isBlock = className?.includes("language-")
    if (isBlock) {
      return (
        <code
          className={`text-xs text-primary/90 font-mono ${className || ""}`}
          {...props}
        >
          {children}
        </code>
      )
    }
    return (
      <code
        className="px-1.5 py-0.5 text-xs font-mono text-primary bg-primary/10"
        {...props}
      >
        {children}
      </code>
    )
  },
  pre: ({ children, ...props }) => (
    <pre
      className="mb-4 p-4 overflow-x-auto text-xs font-mono bg-primary/5 border border-primary/40 leading-relaxed"
      {...props}
    >
      {children}
    </pre>
  ),
  hr: (props) => <hr className="my-6 border-0 h-px bg-primary/40" {...props} />,
  table: ({ children, ...props }) => (
    <div className="overflow-x-auto mb-4">
      <table
        className="w-full text-xs font-mono border-collapse border border-primary/40"
        {...props}
      >
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead className="bg-primary/10" {...props}>
      {children}
    </thead>
  ),
  th: ({ children, ...props }) => (
    <th
      className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-primary border border-primary/40"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td
      className="px-3 py-2 text-primary/80 border border-primary/40"
      {...props}
    >
      {children}
    </td>
  ),
  tr: ({ children, ...props }) => (
    <tr className="even:bg-primary/5" {...props}>
      {children}
    </tr>
  ),
  img: ({ src, alt, ...props }) => (
    <img
      src={src}
      alt={alt || ""}
      loading="lazy"
      className="max-w-full h-auto border border-primary/40 my-4"
      {...props}
    />
  ),
  input: ({ checked, ...props }) => (
    <input
      type="checkbox"
      checked={checked}
      disabled
      readOnly
      className="mr-2 accent-primary"
      {...props}
    />
  ),
  details: ({ children, ...props }) => (
    <details className="mb-4 border border-primary/40 p-3" {...props}>
      {children}
    </details>
  ),
  summary: ({ children, ...props }) => (
    <summary
      className="cursor-pointer font-bold text-sm text-primary tracking-wide"
      {...props}
    >
      {children}
    </summary>
  ),
  del: ({ children, ...props }) => (
    <del className="line-through text-primary/40" {...props}>
      {children}
    </del>
  ),
}

export default function GitHubMarkdown({ content }: { content: string }) {
  return (
    <div className="font-sans [&_*]:rounded-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeSlug,
          rehypeRaw,
          [rehypeSanitize, sanitizeSchema],
        ]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
