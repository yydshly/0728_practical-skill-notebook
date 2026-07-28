export default function BlogRail({ posts }) {
  return (
    <section className="blog-rail" aria-label="Related posts">
      {posts.map((post) => (
        <article className="blog-rail__post" key={post.href}>
          <a href={post.href}>
            <img src={post.imageSrc} alt={post.imageAlt} />
            <div className="blog-rail__copy">
              <h3>{post.title}</h3>
              <p>by {post.author} <span aria-hidden="true">•</span> {post.date}</p>
            </div>
          </a>
        </article>
      ))}
    </section>
  );
}
