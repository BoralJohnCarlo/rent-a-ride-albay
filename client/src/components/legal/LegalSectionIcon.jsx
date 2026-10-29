import { createElement } from "react";

import { getLegalSectionIcon } from "../../constants/legalDocuments";

/* A legal document section's icon, by the name stored on the section. */
const LegalSectionIcon = ({ name, ...props }) =>
    createElement(getLegalSectionIcon(name), props);

export default LegalSectionIcon;
