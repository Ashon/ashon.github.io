---
layout: default
title: Archive
permalink: /archive/
---

{% assign postsByYearMonth = site.posts | group_by_exp:"post", "post.date | date: '%Y %b'" %}

{% for year in postsByYearMonth %}
<h2 id="{{ year.name }}">{{ year.name }}</h2>
<ul aria-label="posts from {{ year.name }}">
  {% for post in year.items %}
    {% include post_item.html %}
  {% endfor %}
</ul>
{% endfor %}
