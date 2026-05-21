import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  children: string;
}

export default function Markdown({ children }: Props) {
  return (
    <div className="markdown text-[15px] leading-relaxed text-foreground">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node: _n, ...p }) => (
            <h1 className="font-display text-2xl mt-6 mb-3 first:mt-0" {...p} />
          ),
          h2: ({ node: _n, ...p }) => (
            <h2 className="font-display text-xl mt-5 mb-2 first:mt-0" {...p} />
          ),
          h3: ({ node: _n, ...p }) => (
            <h3 className="font-semibold text-base mt-4 mb-2 first:mt-0" {...p} />
          ),
          h4: ({ node: _n, ...p }) => (
            <h4 className="font-semibold text-sm mt-3 mb-1.5 first:mt-0" {...p} />
          ),
          p: ({ node: _n, ...p }) => <p className="my-3 first:mt-0 last:mb-0" {...p} />,
          ul: ({ node: _n, ...p }) => (
            <ul className="list-disc pl-5 my-3 space-y-1.5 marker:text-muted-foreground" {...p} />
          ),
          ol: ({ node: _n, ...p }) => (
            <ol className="list-decimal pl-5 my-3 space-y-1.5 marker:text-muted-foreground" {...p} />
          ),
          li: ({ node: _n, ...p }) => <li className="pl-1" {...p} />,
          a: ({ node: _n, ...p }) => (
            <a
              className="text-primary underline underline-offset-2 hover:opacity-80"
              target="_blank"
              rel="noreferrer"
              {...p}
            />
          ),
          strong: ({ node: _n, ...p }) => <strong className="font-semibold" {...p} />,
          em: ({ node: _n, ...p }) => <em className="italic" {...p} />,
          blockquote: ({ node: _n, ...p }) => (
            <blockquote
              className="border-l-2 border-primary/40 pl-4 my-3 text-muted-foreground italic"
              {...p}
            />
          ),
          hr: () => <hr className="my-5 border-border" />,
          table: ({ node: _n, ...p }) => (
            <div className="my-4 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm border-collapse" {...p} />
            </div>
          ),
          thead: ({ node: _n, ...p }) => <thead className="bg-accent/50" {...p} />,
          th: ({ node: _n, ...p }) => (
            <th
              className="px-3 py-2 text-left font-semibold border-b border-border"
              {...p}
            />
          ),
          td: ({ node: _n, ...p }) => (
            <td className="px-3 py-2 border-b border-border/60 last:border-b-0" {...p} />
          ),
          code: ({ node: _n, className, children, ...rest }) => {
            const isBlock = /language-/.test(className ?? "");
            if (isBlock) {
              return (
                <code
                  className={`${className ?? ""} block font-mono text-[13px] leading-relaxed`}
                  {...rest}
                >
                  {children}
                </code>
              );
            }
            return (
              <code
                className="font-mono text-[0.9em] bg-accent/60 text-foreground rounded px-1.5 py-0.5"
                {...rest}
              >
                {children}
              </code>
            );
          },
          pre: ({ node: _n, ...p }) => (
            <pre
              className="my-3 p-3.5 rounded-lg bg-[oklch(0.18_0_0)] text-[oklch(0.95_0_0)] overflow-x-auto"
              {...p}
            />
          ),
          img: ({ node: _n, src, alt, ...rest }) => {
            if (!src) return null;
            return (
              <img
                src={src}
                alt={alt ?? ""}
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
                className="my-3 rounded-lg border border-border max-w-full h-auto"
                {...rest}
              />
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
