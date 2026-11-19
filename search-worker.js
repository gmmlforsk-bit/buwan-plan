function searchArchive(catalog, payload) {
  const {
    query = "",
    format = "",
    decade = "",
    maxHours = "",
    sort = "votes",
    onlyEditorial = false,
    adult = false
  } = payload || {};

  const q = query.trim().toLowerCase();
  const limitHours = maxHours ? Number(maxHours) : null;
  const targetDecade = decade ? Number(decade) : null;

  const terms = q.split(/\s+/);
  const matched = catalog.filter((item) => {
    if (!adult && item.adult) return false;
    if (onlyEditorial && !item.editorialReview) return false;
    if (format && item.format !== format) return false;
    if (targetDecade && item.decade !== targetDecade) return false;
    if (limitHours !== null && (item.totalHours == null || item.totalHours > limitHours)) return false;
    if (q && !terms.every(term => item.searchBlob.includes(term))) return false;
    return true;
  });

  matched.sort((a, b) => {
    if (sort === "score") return (b.score || 0) - (a.score || 0) || (b.votes || 0) - (a.votes || 0);
    if (sort === "year") return (b.year || 0) - (a.year || 0) || (b.score || 0) - (a.score || 0);
    if (sort === "hoursAsc") return (a.totalHours ?? Infinity) - (b.totalHours ?? Infinity);
    return (b.votes || 0) - (a.votes || 0);
  });

  return matched.map(item => item.id);
}

if (typeof document === "undefined") {
  let index = [];
  self.onmessage = ({data}) => {
    if (data.type === "INIT") index = data.payload;
    else if (data.type === "SEARCH") self.postMessage({
      type: "RESULTS", ids: searchArchive(index, data.payload), requestId: data.requestId
    });
  };
}
