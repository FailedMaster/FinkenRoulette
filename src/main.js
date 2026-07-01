import './style.css'

const $ = document.querySelector.bind(document);
const $$ = document.querySelectorAll.bind(document);

$('#app').innerHTML = `
  <div>
    <h1>Hello Finkenroulette!</h1>
    <img src="/mysterybeer.png"/ style="width: 300px; height: 300px;"/>
  </div>
`;

$('img').addEventListener('click', () => {
  $('#app').insertAdjacentHTML('beforeend', '<span style="font-size: 8em;">🍺</span>');
});