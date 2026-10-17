try { var t = localStorage.getItem('jh-theme'); if (t) document.documentElement.setAttribute('data-theme', t); } catch (e) { /* storage unavailable */ }
