export const validateModelPayload = (Model, payload) => {
  const error = new Model(payload).validateSync();
  if (error) throw error;
};
