import { isNumber } from "../beerData.js";

function BeerResult({ beer }) {
  const sizes = (beer.sizes || "").split("/");
  const prices = (beer.prices || "").split("/");

  return (
    <div id="result">
      <div id="beer-name">
        <p>{beer.name}</p>
      </div>
      <div id="beer-info">
        <p>
          {beer.category} (alc. {beer.alcohol}
          {isNumber(beer.alcohol) ? "% vol." : ""})
        </p>
      </div>
      <div id="beer-pricing">
        <table>
          <tbody>
            {sizes.map((size, index) => (
              <tr key={`${size}-${index}`}>
                <td>{size}:</td>
                <td>{prices[index] || ""}€</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div id="beer-description">
        <p>{beer.description ? `"${beer.description}"` : ""}</p>
      </div>
      <div id="beer-hint">
        <p>{beer.hint ? `[${beer.hint}]` : ""}</p>
      </div>
    </div>
  );
}

export default BeerResult;
