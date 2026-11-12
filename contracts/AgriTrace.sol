// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title AgriTrace - traceability of agricultural products, from farm to consumer
/// @notice Each batch (lot) has an owner and a history of steps that can only grow.
contract AgriTrace {
    enum Role { None, Farmer, Cooperative, Transporter, Retailer }

    struct Batch {
        uint id;
        string product;        // e.g. "Tomates cerises bio"
        uint quantityKg;
        string origin;         // e.g. "Ferme Chtouka - parcelle B3"
        address currentOwner;
        bool exists;
    }

    struct Step {
        address actor;         // who recorded the step (signed the transaction)
        string action;         // "Recolte", "Emballage", "Transport"...
        string location;
        string details;        // "4-8 C", "760 kg categorie A"...
        bytes32 docHash;       // fingerprint of a certificate / lab report (0 if none)
        uint timestamp;
    }

    address public admin;
    mapping(address => Role) public roles;
    mapping(address => string) public names;
    mapping(uint => Batch) public batches;
    mapping(uint => Step[]) private history;
    uint public nextId = 1;

    event ActorRegistered(address indexed actor, Role role, string name);
    event BatchCreated(uint indexed id, address indexed farmer, string product);
    event StepAdded(uint indexed id, address indexed actor, string action);
    event OwnershipTransferred(uint indexed id, address indexed from, address indexed to);

    constructor() {
        admin = msg.sender;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "NOT_ADMIN");
        _;
    }

    modifier onlyOwner(uint id) {
        require(batches[id].exists, "UNKNOWN_BATCH");
        require(batches[id].currentOwner == msg.sender, "NOT_OWNER");
        _;
    }

    /// The admin gives a role and a name to an actor of the supply chain.
    function registerActor(address actor, Role role, string calldata name) external onlyAdmin {
        roles[actor] = role;
        names[actor] = name;
        emit ActorRegistered(actor, role, name);
    }

    /// Only a farmer can create a batch: this is its "birth certificate".
    function createBatch(
        string calldata product,
        uint quantityKg,
        string calldata origin,
        bytes32 certHash
    ) external returns (uint) {
        require(roles[msg.sender] == Role.Farmer, "ONLY_FARMER");
        require(quantityKg > 0, "BAD_QUANTITY");
        uint id = nextId++;
        batches[id] = Batch(id, product, quantityKg, origin, msg.sender, true);
        history[id].push(Step(msg.sender, "Recolte", origin, "", certHash, block.timestamp));
        emit BatchCreated(id, msg.sender, product);
        return id;
    }

    /// Only the current owner of the batch can add a step to its history.
    function addStep(
        uint id,
        string calldata action,
        string calldata location,
        string calldata details,
        bytes32 docHash
    ) external onlyOwner(id) {
        history[id].push(Step(msg.sender, action, location, details, docHash, block.timestamp));
        emit StepAdded(id, msg.sender, action);
    }

    /// The owner passes the batch to the next registered actor.
    function transfer(uint id, address to) external onlyOwner(id) {
        require(roles[to] != Role.None, "UNKNOWN_ACTOR");
        require(to != msg.sender, "SAME_OWNER");
        batches[id].currentOwner = to;
        history[id].push(Step(msg.sender, "Transfert", "", names[to], bytes32(0), block.timestamp));
        emit OwnershipTransferred(id, msg.sender, to);
    }

    /// Free read function used by the consumer page. There is no update or delete function.
    function getHistory(uint id) external view returns (Step[] memory) {
        require(batches[id].exists, "UNKNOWN_BATCH");
        return history[id];
    }
}
