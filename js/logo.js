/* شعار عيادة الشروق كـ SVG (الشمس + الدايرة + السنة + النجوم) */
(function () {
  var TOOTH =
    'M -20 -18 C -27 -18 -29 -7 -27 3 C -25 13 -21 19 -18 27 C -16 33 -10 33 -9 26 ' +
    'C -8 19 -5 11 0 11 C 5 11 8 19 9 26 C 10 33 16 33 18 27 C 21 19 25 13 27 3 ' +
    'C 29 -7 27 -18 20 -18 C 13 -18 8 -14 0 -14 C -8 -14 -13 -18 -20 -18 Z';
  var STAR = 'M0 -9 C1.2 -2.4 2.4 -1.2 9 0 C2.4 1.2 1.2 2.4 0 9 C-1.2 2.4 -2.4 1.2 -9 0 C-2.4 -1.2 -1.2 -2.4 0 -9 Z';
  var RAY = 'M -7.5 -67 Q -6 -82 4.5 -94 Q 1.5 -80 7.5 -67 Z';
  var uid = 0;

  window.logoSVG = function (opts) {
    opts = opts || {};
    var id = 'lg' + (++uid);
    var n = 20, rays = '';
    for (var i = 0; i < n; i++) {
      var a = (360 / n) * i;
      rays += '<path class="ray" d="' + RAY + '" style="--a:' + a + 'deg;--i:' + i + '" transform="translate(100 100) rotate(' + a + ')"/>';
    }
    return (
      '<svg class="logo-mark ' + (opts.cls || '') + '" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-label="عيادة الشروق">' +
      '<defs>' +
      '<linearGradient id="' + id + 'g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#2a3388"/><stop offset=".55" stop-color="#2b63b5"/><stop offset="1" stop-color="#29a9e1"/>' +
      '</linearGradient>' +
      '<radialGradient id="' + id + 'glow"><stop offset="0" stop-color="#f6b623" stop-opacity=".45"/><stop offset="1" stop-color="#f6b623" stop-opacity="0"/></radialGradient>' +
      '<clipPath id="' + id + 'c"><circle cx="100" cy="100" r="60"/></clipPath>' +
      '</defs>' +
      '<circle class="glow" cx="100" cy="100" r="100" fill="url(#' + id + 'glow)"/>' +
      '<g class="rays-spin"><g class="rays" fill="#f6b623">' + rays + '</g></g>' +
      '<circle class="ripple r1" cx="100" cy="100" r="60" fill="none" stroke="#f6b623" stroke-width="2"/>' +
      '<circle class="ripple r2" cx="100" cy="100" r="60" fill="none" stroke="#29a9e1" stroke-width="2"/>' +
      '<circle class="halo" cx="100" cy="100" r="64" fill="#fff"/>' +
      '<circle class="disc" cx="100" cy="100" r="60" fill="url(#' + id + 'g)"/>' +
      '<circle class="flash" cx="100" cy="100" r="60" fill="#fff"/>' +
      '<g clip-path="url(#' + id + 'c)"><g transform="skewX(-20)"><rect class="sheen" x="0" y="30" width="30" height="150" fill="#fff" opacity=".2"/></g></g>' +
      '<g transform="translate(96 104) scale(1.12)"><g class="tooth-drop"><path class="tooth" d="' + TOOTH + '"/></g></g>' +
      '<g transform="translate(126 78)"><path class="star s1" d="' + STAR + '" fill="#fff"/></g>' +
      '<g transform="translate(135 95) scale(.62)"><path class="star s2" d="' + STAR + '" fill="#fff"/></g>' +
      '</svg>'
    );
  };
})();
