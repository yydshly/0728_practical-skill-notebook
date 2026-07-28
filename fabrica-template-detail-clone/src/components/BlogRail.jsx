export default function BlogRail({ posts }) {
  return (
    <section className="blog-rail" aria-label="Related posts">
      {posts.map((post) => (
        <article className="blog-rail__post" key={post.href}>
          <a href={post.href}>
            <img src={post.imageSrc} alt={post.imageAlt} />
            <h3>{post.title}</h3>
          </a>
        </article>
      ))}
    </section>
  );
}
