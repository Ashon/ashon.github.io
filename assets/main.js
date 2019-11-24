(() => {
  const TAG_CLASS = 'tag-item';
  const TAG_ACTIVE_CLASS = 'active';
  const TAG_ID_PREFIX = 'tag-';

  const TAG_ARCHIVE_ACTIVE_CLASS = 'active';
  const TAG_ARCHIVE_ID_PREFIX = 'tag-archive-';

  const Context = {
    tags: [],
    archivesByTag: {},

    init: () =>{
      this.tags = document.getElementsByClassName(TAG_CLASS);
      this.archivesByTag = {};

      Array.from(this.tags).forEach((tag) => {
        let archiveId = `${tag.id.replace(TAG_ID_PREFIX, TAG_ARCHIVE_ID_PREFIX)}`;

        this.archivesByTag[tag.id] = document.getElementById(archiveId);
      });

      Array.from(this.tags).forEach((tag) => Context.onClickTag(tag));

      Context.invalidate();
    },

    clearSelectedTag: () => {
      Array.from(this.tags).forEach((tag) => {
        tag.classList.remove(TAG_ACTIVE_CLASS)
      });
    },

    clearSelectedArchive: () => {
      Object.entries(this.archivesByTag).forEach((entry) => {
        entry[1].classList.remove(TAG_ACTIVE_CLASS);
      });
    },

    invalidate: () => {
      let selectedTagId = `${TAG_ID_PREFIX}${window.location.hash.replace('#', '')}`;
      let selectedTag = document.getElementById(selectedTagId);

      if (selectedTag !== null) {
       selectedTag.classList.add(TAG_ACTIVE_CLASS);
      }

      this.archivesByTag[selectedTagId].classList.add(TAG_ARCHIVE_ACTIVE_CLASS);
    },

    onClickTag: (tag) => {
      let that = this;
      tag.onclick = function(e) {
        Context.clearSelectedTag();
        Context.clearSelectedArchive();

        tag.classList.add(TAG_ACTIVE_CLASS);
        that.archivesByTag[tag.id].classList.add(TAG_ARCHIVE_ACTIVE_CLASS);
      };
    }
  };

  document.addEventListener('DOMContentLoaded', (e) => {
    Context.init();
  });
})();
