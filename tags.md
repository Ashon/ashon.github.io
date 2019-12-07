---
layout: page
permalink: /tags/
title: Tags
---

<ul class="tag-container">
{% for tag in site.tags %}
  {% capture tag_name %}{{ tag|first|slugize }}{% endcapture %}
  {% capture tag_size %}{{ tag|last|size }}{% endcapture %}
  <li>
    <a class="tag-item large" id="tag-{{ tag_name }}" href="#{{ tag_name }}">{{ tag_name }} <small>| {{ tag_size }}</small></a>
  </li>
{% endfor %}
</ul>

<div id="archives">
{% for tag in site.tags %}
  {% capture tag_name %}{{ tag | first }}{% endcapture %}
  <div class="archive-group" id="tag-archive-{{ tag_name }}">
    <h4 id="#{{ tag_name | slugize }}">
      {{ tag_name }}
    </h4>
    <ul>
      {% for post in site.tags[tag_name] %}
      <li class="archive-item">
        <a href="{{ root_url }}{{ post.url }}">{{ post.title }}</a>
      </li>
      {% endfor %}
    </ul>
  </div>
{% endfor %}
</div>
