function FormErrorMessage({ message }) {
  if (!message) {
    return null;
  }

  return <p className="form-error-message">{message}</p>;
}

export default FormErrorMessage;