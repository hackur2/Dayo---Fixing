import MenuImagePicker from "../MenuImagePicker";

function AddComboFields({ formData, alaCarteOptions, onChange }) {
  function handleImageChange(imageData) {
    onChange({
      ...formData,
      ...imageData,
    });
  }

  return (
    <>
      <label>
        Ala Carte 1
        <select
          value={formData.firstItemId}
          onChange={(event) =>
            onChange({
              ...formData,
              firstItemId: event.target.value,
            })
          }
        >
          <option value="">Choose ala carte</option>
          {alaCarteOptions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        Ala Carte 2
        <select
          value={formData.secondItemId}
          onChange={(event) =>
            onChange({
              ...formData,
              secondItemId: event.target.value,
            })
          }
        >
          <option value="">Choose ala carte</option>
          {alaCarteOptions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        Combined Price
        <input
          type="number"
          min="0"
          value={formData.price}
          onChange={(event) =>
            onChange({
              ...formData,
              price: event.target.value,
            })
          }
          placeholder="Example: 120"
        />
      </label>

      <MenuImagePicker
        imageUrl={formData.imageUrl}
        imageFileName={formData.imageFileName}
        onChange={handleImageChange}
      />
    </>
  );
}

export default AddComboFields;
