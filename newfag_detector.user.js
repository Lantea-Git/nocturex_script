// ==UserScript==
// @name         Newfag detecor
// @version      2.8.6
// @description  Affiche l'ancienneté des pseudos qui le cachent
// @author       NocturneX
// @match        *://www.jeuxvideo.com/profil/*?mode=infos
// @grant        GM_xmlhttpRequest
// @icon         http://image.noelshack.com/fichiers/2017/15/1491900495-7.png
// @connect      api.jeuxvideo.com
// @downloadURL  https://github.com/Lantea-Git/nocturex_script/raw/main/newfag_detector.user.js
// @updateURL    https://github.com/Lantea-Git/nocturex_script/raw/main/newfag_detector.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/crypto-js/3.1.9-1/crypto-js.min.js
// ==/UserScript==

(() => {
  if (document.querySelector('.img-erreur')) return;

  const searchAndDisplay = async (col) => {
    const alreadyDisplayed = Array.from(document.querySelectorAll('.info-lib')).find((div) => div.textContent.trim() === 'Membre depuis :');

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
            <div class="info-lib">Membre depuis :</div>
            <div class="info-value">
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


    createBloc(`<a id="voir-date" href="#">Cliquer pour afficher la date</a>`);

    //Continue fonction (click ou souris over)
    await new Promise(continuer => {
      const lien = bloc.querySelector('#voir-date');
      const typesEvenement = ['click', 'mouseover'];
      for (const type of typesEvenement) {
        lien.addEventListener(type, event => {
          event.preventDefault(); //anule la redirection href
          continuer();
        });
      }
    });


    createBloc(`Newfag Detector cherche ...`);

    const requestApiJvc = (url) => new Promise((resolve, reject) => {
      const timestamp = new Date().toISOString();
      const method = 'GET';
      const apivers = 'v3' //passer à 'v4' si ça ne marche pas
      const signature = CryptoJS.HmacSHA256(`550c04bf5cb2b\n${timestamp}\n${method}\napi.jeuxvideo.com\n/${apivers}/${url}\n`, 'd84e9e5f191ea4ffc39c22d11c77dd6c');
      const header = `PartnerKey=550c04bf5cb2b, Signature=${signature}, Timestamp=${timestamp}`;
      GM_xmlhttpRequest({
        method,
        headers: {
          'Jvc-Authorization': header,
          'Content-Type': 'application/json',
        },
        url: `https://api.jeuxvideo.com/${apivers}/${url}`,
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

  searchAndDisplay(document.querySelector('#page-profil > .layout__content > .row > .col-lg-6'));
})();
