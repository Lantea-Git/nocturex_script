// ==UserScript==
// @name         Newfag detecor
// @version      3.0.3
// @description  Affiche l'ancienneté des pseudos qui le cachent
// @author       NocturneX
// @match        *://www.jeuxvideo.com/profil/*?mode=infos
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @icon         http://image.noelshack.com/fichiers/2017/15/1491900495-7.png
// @connect      api.jeuxvideo.com
// @downloadURL  https://github.com/Lantea-Git/nocturex_script/raw/main/newfag_detector.user.js
// @updateURL    https://github.com/Lantea-Git/nocturex_script/raw/main/newfag_detector.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/crypto-js/3.1.9-1/crypto-js.min.js
// ==/UserScript==

(() => {
  if (document.querySelector('.img-erreur')) return;

  const searchAndDisplay = async (col) => {
    const alreadyDisplayed = [...document.querySelectorAll('.info-lib')].find((div) => div.textContent.trim() === 'Membre depuis :');

    if (alreadyDisplayed) return;

    const bell = document.querySelector('#header-profil .icon-bell-off');
    const pictoAttention = document.querySelector('#header-profil .icon-report-problem');
    let pseudoId;

    if (bell) {
      pseudoId = bell.dataset.id;
    } else if (pictoAttention && /\/profil\/gta\.php\?id=([0-9]+)&/g.test(pictoAttention.dataset.selector)) {
      pseudoId = RegExp.$1.trim();
    }

    if (!pseudoId) {
      throw new Error('Impossible de récupérer l\'id du pseudo');
    }

    pseudoId = parseInt(pseudoId, 10);

    let bloc = document.createElement('div');
    bloc.classList.add('bloc-default-profil');
    bloc.innerHTML = `
      <div class="bloc-default-profil-header">
        <h2>Newfag Detector</h2>
      </div>
      <div class="bloc-default-profil-body">
        <ul class="display-line-lib">
          <li>
            <div class="info-lib" title="Afficher systématiquement la date" style="cursor: pointer;">Membre depuis :</div>
            <div class="info-value"><a id="voir-date" href="#">Cliquer pour afficher la date</a>
            </div>
          </li>
        </ul>
      </div>`;
    col.insertBefore(bloc, col.children[1] || null);

    // Injecte le contenu html
    const createBloc = (html) => {
      bloc.querySelector('.info-value').innerHTML = html;
    };


    const createBlocError = (message) => createBloc(`${message || 'La date de création du pseudo n\'a pas pu être estimée.'}`);

    if (pseudoId <= 2499961) {
      createBlocError('Ce pseudo a été créé avant le 16 février 2010.<br>La date exacte ne peut pas être estimée.');
      return;
    }

    //Affiche automatiquement la date 
    bloc.querySelector('.info-lib')?.addEventListener('click', () => {
      const newFagAuto = localStorage.getItem('newfag_flag_auto') === 'true';
      if (!confirm(`${newFagAuto ? 'Ne plus afficher' : 'Afficher'} systématiquement la date ?`)) return;

      localStorage.setItem('newfag_flag_auto', newFagAuto ? 'false' : 'true');
      bloc.querySelector('#voir-date')?.click();
    });


    // On continue l'exécution avec un clic ou si le local Storage est en auto .
    if (localStorage.getItem('newfag_flag_auto') !== 'true') {
      await new Promise(continuerScript => {
        const eventTypeTactile = !window.matchMedia('(hover: hover)').matches ? 'click' : 'mouseover';
        bloc.querySelector('#voir-date').addEventListener(eventTypeTactile, event => {
          event.preventDefault();
          continuerScript();
        }, { once: true });
      });
    }


    createBloc(`Newfag Detector cherche ...`);

    const requestApiJvc = (url) => new Promise((resolve, reject) => {
      const partnerKey = '550c04bf5cb2b';
      const hmacSec = 'd84e9e5f191ea4ffc39c22d11c77dd6c';
      const timestamp = new Date().toISOString();
      const method = 'GET';
      const apiVersion = 'v4' //passer à 'v5' si ça ne marche pas
      const signature = CryptoJS.HmacSHA256(`${partnerKey}\n${timestamp}\n${method}\napi.jeuxvideo.com\n/${apiVersion}/${url}\n`, hmacSec);
      const header = `PartnerKey=${partnerKey}, Signature=${signature}, Timestamp=${timestamp}`;
      //Utilisation du module GM_xmlhttpRequest ou GM.xmlHttpRequest (Greasemonkey)
      (typeof GM_xmlhttpRequest === 'function' ? GM_xmlhttpRequest : GM?.xmlHttpRequest)?.({
        method,
        headers: {
          'Jvc-Authorization': header,
          'Content-Type': 'application/json',
        },
        url: `https://api.jeuxvideo.com/${apiVersion}/${url}`,
        onload: (response) => resolve(JSON.parse(response.responseText)),
        onerror: (response) => reject(response),
      });
    });

    const searchDate = async (direction) => {
      const maxTry = 20;
      let date = null;
      for (let i = 1; i <= maxTry; i += 1) {
        try {
          const id = pseudoId + (i * direction);
          console.log('Newfag Detector: Requête le pseudo n°', id);
          const profile = await requestApiJvc(`accounts/${id}/profile`);
          if (profile.info && profile.info.creationDate) {
            date = new Date(profile.info.creationDate);
            console.log('Newfag Detector: Date trouvée', date, 'pour le pseudo', id, profile.alias);
            break;
          }
        } catch (e) {
          console.log('Newfag Detector: Erreur requête', e);
        }
      }
      return date;
    };

    const daysBetween = (date1, date2) => Math.round(Math.abs((date1.getTime() - date2.getTime()) / (24 * 60 * 60 * 1000)));

    const displayNumber = (number) => number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

    const displayDate = (date) => new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const dateBefore = await searchDate(-1);
    const dateAfter = await searchDate(1);

    if (!dateBefore) {
      createBlocError();
      throw new Error('Impossible de récupérer la date de création du pseudo avant');
    }

    if (!dateAfter) {
      createBlocError();
      throw new Error('Impossible de récupérer la date de création du pseudo après');
    }

    const dateBeforeFormated = displayDate(dateBefore);
    const dateAfterFormated = displayDate(dateAfter);

    if (dateBeforeFormated !== dateAfterFormated) {
      console.log('Newfag Detector: Les deux dates ne correspondent pas', dateBeforeFormated, dateAfterFormated);
      createBlocError(`Ce pseudo a été créé entre <br>Le ${dateBeforeFormated} et le ${dateAfterFormated}.<br>Le jour exact ne peut pas être estimé.`);
      return;
    }

    const nbDays = daysBetween(dateBefore, new Date());

    createBloc(`${dateBeforeFormated} (${displayNumber(nbDays)} jours)`);
  };

  const alertDanger = document.querySelector('#page-profil .alert.alert-danger');
  if (alertDanger && alertDanger.textContent.trim() === 'Le pseudo est banni.') {
    setTimeout(() => {
      const jvcdvBody = document.querySelector('.jvcdv-body');

      if (!jvcdvBody) return;

      let col = jvcdvBody.querySelector('.col-lg-6') || jvcdvBody.querySelector('.col-md-6'); //JVCDV 2 non mis à jour

      if (!col) {
        col = document.createElement('div');
        col.classList.add('col-lg-6');
        jvcdvBody.after(col);
      }

      searchAndDisplay(col);
    }, 2000);
    return;
  }

  //chemin du selecteur css pour savoir où check la date et ajouter le bloc newfag
  searchAndDisplay(document.querySelector('#page-profil > .layout__content > .row > .col-lg-6'));
})();
