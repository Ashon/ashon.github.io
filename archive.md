---
layout: default
title: Archive
permalink: /archive/
---

{% assign postsByYearMonth = site.posts | group_by_exp:"post", "post.date | date: '%Y %b'" %}

{% for year in postsByYearMonth %}
<h3 id="{{ year.name }}">{{ year.name }}</h3>

<ul class="post-list archive" aria-label="posts from {{ year.name }}">
  {% for post in year.items %}
    <li>
      {% include post_item.html show_excerpts=false %}
    </li>
  {% endfor %}
</ul>
{% endfor %}
