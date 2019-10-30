---
layout: page
permalink: /tags/
title: Tags
---

<ul class="tag-cloud">
{% for tag in site.tags %}
  {% capture tag_name %}{{ tag|first|slugize }}{% endcapture %}
  {% capture font_size %}{{ tag|last|size| times:100 | divided_by:site.tags.size | plus: 50 }}%{% endcapture %}
  {% capture tag_size %}{{ tag|last|size }}{% endcapture %}
  <li style="font-size: {{ font_size }}%">
    <a href="#{{ tag_name }}">
      {{ tag_name }} {{ tag_size }}
    </a>
  </li>
{% endfor %}
</ul>

<div id="archives">
{% for tag in site.tags %}
  <div class="archive-group">
    {% capture tag_name %}{{ tag | first }}{% endcapture %}
    <h3 id="#{{ tag_name | slugize }}">{{ tag_name }}</h3>
    <a name="{{ tag_name | slugize }}"></a>
    {% for post in site.tags[tag_name] %}
    <article class="archive-item">
      <h4><a href="{{ root_url }}{{ post.url }}">{{ post.title }}</a></h4>
    </article>
    {% endfor %}
  </div>
{% endfor %}
</div>
