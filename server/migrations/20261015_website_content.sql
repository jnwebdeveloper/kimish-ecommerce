CREATE TABLE IF NOT EXISTS seo_pages (
  id serial PRIMARY KEY, path text UNIQUE NOT NULL, title text NOT NULL,
  description text NOT NULL DEFAULT '', image text NOT NULL DEFAULT '',
  noindex boolean NOT NULL DEFAULT false, active boolean NOT NULL DEFAULT true
);
INSERT INTO settings(key,value,description) VALUES
('meta_pixel_id','','Meta Pixel ID; leave blank to disable tracking'),
('seo_title','Kimish | Premium Nuts, Seeds, Dry Fruits & Gifts','Default website SEO title'),
('seo_description','Discover nuts, seeds, dry fruits and thoughtful gift boxes from Kimish.','Default website meta description')
ON CONFLICT(key) DO NOTHING;
INSERT INTO pages(slug,title,content,active) VALUES
('about-us','About Us','Kimish brings together nuts, seeds, dry fruits and thoughtful gift boxes. Explore our collection for everyday favourites and special occasions.',true),
('contact-us','Contact Us','For product questions, order enquiries or gifting requests, contact our support team using the details below.',true),
('terms-and-conditions','Terms & Conditions','Add your business terms and conditions here before publishing.',false),
('privacy-policy','Privacy Policy','Add your privacy policy, including your use of analytics and advertising tools, here before publishing.',false)
ON CONFLICT(slug) DO NOTHING;
