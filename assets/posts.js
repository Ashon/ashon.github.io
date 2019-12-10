// table scroll wrapper
(() => {
  const POST_CONTENT_CLASS = 'post-content';
  const TABLE_WRAPPER_CLASS = 'table-wrapper';

  const TableWrapper = {
    post_content: undefined,
    tables: [],
    init: () => {
      let post_collection = document.getElementsByClassName(POST_CONTENT_CLASS);
      this.post_content = post_collection && post_collection.item(0);
      if (this.post_content) {
        this.tables = this.post_content.getElementsByTagName('table');

        Array.from(this.tables).forEach((table) => {
          let tableWrapper = document.createElement('div');
          tableWrapper.className = TABLE_WRAPPER_CLASS;

          table.parentNode.insertBefore(tableWrapper, table);
          tableWrapper.appendChild(table);
        });
      }
    }
  };

  TableWrapper.init();
})();
