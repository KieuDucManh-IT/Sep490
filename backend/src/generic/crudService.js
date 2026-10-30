export const createCrudService = (Model, validate, populateFields = []) => ({
  list: () => {
    let query = Model.find().sort({ createdAt: -1 });
    for (const field of populateFields) query = query.populate(field);
    return query;
  },
  create: async (payload) => Model.create(validate(payload)),
  update: async (id, payload) => {
    const document = await Model.findById(id);
    if (!document) return null;
    const changes = validate(payload, document.toObject());
    Object.assign(document, changes);
    return document.save();
  },
  remove: (id) => Model.findByIdAndDelete(id),
});
