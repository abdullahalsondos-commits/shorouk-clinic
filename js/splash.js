/* شاشة البداية: السنة بتقع → الشمس بتلف → الاسم بيظهر → الشاشة بتتفتح على الدخول */
(function () {
  var S = document.getElementById('splash');
  var box = document.getElementById('splash-logo');
  var bg = S.querySelector('.splash-bg');
  box.innerHTML = window.logoSVG({ cls: 'assemble' });
  var T0 = performance.now();
  var MIN = 4300; // مدة الأنيميشن قبل ما تتفتح
  var done = false;

  // فتحة دايرية بتكبر من مكان اللوجو لحد ما تكشف الصفحة اللي ورا
  function openHole(x, y, ms, cb) {
    bg.style.setProperty('--hx', x + 'px');
    bg.style.setProperty('--hy', y + 'px');
    var max = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 40;
    var t0 = performance.now();
    (function step(now) {
      var t = Math.min(1, (now - t0) / ms);
      var e = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      bg.style.setProperty('--hole', (e * max).toFixed(1) + 'px');
      if (t < 1) requestAnimationFrame(step); else cb && cb();
    })(performance.now());
  }

  window.__splash = {
    finish: function () {
      if (done) return; done = true;
      var wait = Math.max(0, MIN - (performance.now() - T0));
      setTimeout(function () {
        var target = document.querySelector('[data-logo-target]');
        var tr = target && target.getBoundingClientRect();
        var visible = tr && tr.width > 0 && tr.bottom > 0 && tr.top < innerHeight;
        var lr = box.getBoundingClientRect();
        var cx = lr.left + lr.width / 2, cy = lr.top + lr.height / 2;
        S.classList.add('exit');
        openHole(cx, cy, 1100);
        if (visible) {
          var dx = (tr.left + tr.width / 2) - cx;
          var dy = (tr.top + tr.height / 2) - cy;
          var sc = tr.width / lr.width;
          target.style.opacity = '0';
          box.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(' + sc + ')';
          setTimeout(function () {
            target.style.transition = 'opacity .25s';
            target.style.opacity = '1';
            S.classList.add('gone');
            setTimeout(function () { S.remove(); }, 400);
          }, 1050);
        } else {
          box.style.transition = 'transform .8s ease, opacity .8s ease';
          box.style.transform = 'scale(1.4)'; box.style.opacity = '0';
          setTimeout(function () { S.classList.add('gone'); setTimeout(function () { S.remove(); }, 400); }, 1000);
        }
      }, wait);
    },
  };
})();
