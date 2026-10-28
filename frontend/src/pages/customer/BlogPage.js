import React from "react";
import { Link } from "react-router-dom";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import "../../styles/BlogPage.css";

const BLOG_POSTS = [
  {
    id: 1,
    title: "Xu Hướng Thời Trang Dạ Hội 2026: Sắc Tím Quý Phái & Lụa Tự Nhiên",
    category: "Xu hướng",
    date: "25/10/2026",
    readTime: "5 phút đọc",
    image: "https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=600&q=80",
    excerpt: "Khám phá các thiết kế đầm dạ hội cách tân đang làm mưa làm gió trong các sự kiện sang trọng mùa lễ hội năm nay.",
  },
  {
    id: 2,
    title: "Bí Quyết Chọn Áo Dài Cách Tân Phù Hợp Vóc Dáng Cho Mọi Dịp Lễ",
    category: "Cẩm nang",
    date: "20/10/2026",
    readTime: "4 phút đọc",
    image: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=600&q=80",
    excerpt: "Cách lựa chọn form dáng, tà áo và họa tiết thêu tay để tôn lên nét duyên dáng, thanh thoát và hiện đại.",
  },
  {
    id: 3,
    title: "Thời Trang Tuần Hoàn: Vì Sao Thuê Đồ Đang Trở Thành Lối Sống Mới?",
    category: "Phong cách sống",
    date: "15/10/2026",
    readTime: "6 phút đọc",
    image: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=600&q=80",
    excerpt: "Tiết kiệm đến 80% chi phí cho mỗi lần diện đồ đẹp và cùng chung tay bảo vệ môi trường với nền tảng VESTORA.",
  },
  {
    id: 4,
    title: "Hướng Dẫn Thử Đồ Bằng AI & Camera: Chuẩn Từng Centimet",
    category: "Công nghệ",
    date: "10/10/2026",
    readTime: "3 phút đọc",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80",
    excerpt: "Trải nghiệm tính năng ướm trang phục ảo trực tiếp ngay tại nhà giúp bạn tự tin lựa chọn đúng kích cỡ mà không cần ra tiệm.",
  },
];

export default function BlogPage() {
  return (
    <div className="vestora-page-wrapper">
      <Navbar />
      <main className="blog-main-container">
        <header className="blog-header-section">
          <span className="blog-tagline">TIN TỨC & GỢI Ý PHONG CÁCH</span>
          <h1 className="blog-main-title">Blog Min.De</h1>
          <p className="blog-subtext">
            Cập nhật xu hướng thời trang mới nhất, cẩm nang phối đồ và câu chuyện thời trang bền vững.
          </p>
        </header>

        <section className="blog-articles-grid">
          {BLOG_POSTS.map((post) => (
            <article key={post.id} className="blog-card">
              <div className="blog-card-media">
                <img src={post.image} alt={post.title} />
                <span className="blog-badge">{post.category}</span>
              </div>
              <div className="blog-card-body">
                <div className="blog-meta">
                  <span><i className="fa-regular fa-calendar"></i> {post.date}</span>
                  <span>•</span>
                  <span><i className="fa-regular fa-clock"></i> {post.readTime}</span>
                </div>
                <h2 className="blog-post-title">
                  <Link to={`/blog/${post.id}`}>{post.title}</Link>
                </h2>
                <p className="blog-excerpt">{post.excerpt}</p>
                <Link to={`/blog/${post.id}`} className="blog-read-more">
                  Đọc tiếp <i className="fa-solid fa-arrow-right"></i>
                </Link>
              </div>
            </article>
          ))}
        </section>
      </main>
      <Footer />
    </div>
  );
}
